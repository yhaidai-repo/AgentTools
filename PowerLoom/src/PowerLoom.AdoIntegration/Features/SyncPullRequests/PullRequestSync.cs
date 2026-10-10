using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;

namespace PowerLoom.AdoIntegration.Features.SyncPullRequests;

// One check of the vault's pull requests; the database only (the review's notes come from the review runs).
public sealed class PullRequestSync(PowerLoomDbContext db)
{
    private const string Actor = "pull-requests";
    private const string UnlistedReason = "The PR was completed or abandoned in Azure DevOps, or you're no longer a reviewer.";
    private const string RepoNotSelectedReason = "Its repo isn't selected for code review in Settings.";

    public async Task<string> RunAsync(string vault, AdoSettings ado, PullRequestSettings settings, IAdoClient client, CancellationToken cancellation)
    {
        // A review deleted in adoa stays deleted (user decision 2026-10-06).
        var deleted = (await db.DeletedPullRequests.Select(row => row.Id).ToListAsync(cancellation)).ToHashSet();
        var mine = (await client.ListActivePullRequestsAsync(cancellation)).Where(pr => PullRequestFilter.IsMine(pr, ado.User) && !deleted.Contains(pr.Id)).ToList();
        var listed = mine.Where(pr => PullRequestFilter.IsSelectedRepo(pr, settings.Repos)).ToList();
        var changed = await ChangedAsync(listed, cancellation);
        var updated = changed.Take(settings.MaxPullRequestsPerRun).ToList();

        foreach (var pr in updated)
            await UpsertAsync(vault, client, pr, cancellation);

        await MarkListedAsync(listed, cancellation);

        var added = await AddNewReviewsAsync(listed, cancellation);
        var closed = await CloseUnlistedAsync(listed, mine, cancellation);

        return Summary(listed.Count, mine.Count - listed.Count, updated.Count, changed.Count - updated.Count, added, closed);
    }

    private static string Summary(int listed, int notSelected, int updated, int waiting, int added, int closed)
    {
        var notSelectedNote = notSelected > 0 ? $" ({notSelected} more in repos not selected)" : "";
        var waitingNote = waiting > 0 ? $" ({waiting} next run)" : "";

        return $"{listed} PR(s) you review{notSelectedNote}, {updated} updated{waitingNote}, {added} new review(s), {closed} closed";
    }

    // New PRs and PRs with a new push need their details (pushes, linked work items); the rest are unchanged.
    private async Task<List<AdoPullRequest>> ChangedAsync(List<AdoPullRequest> listed, CancellationToken cancellation)
    {
        var known = await KnownAsync(listed.Select(pr => pr.Id).ToList(), cancellation);

        return listed.Where(pr => !known.TryGetValue(pr.Id, out var row) || row.SourceCommit != pr.SourceCommit || row.IsDraft != pr.IsDraft).ToList();
    }

    private async Task<Dictionary<int, PullRequest>> KnownAsync(List<int> ids, CancellationToken cancellation)
    {
        return await db.PullRequests.AsNoTracking().Where(row => ids.Contains(row.Id)).ToDictionaryAsync(row => row.Id, cancellation);
    }

    private async Task UpsertAsync(string vault, IAdoClient client, AdoPullRequest pr, CancellationToken cancellation)
    {
        var details = await client.GetPullRequestDetailsAsync(pr.RepoId, pr.Id, cancellation);
        var row = await db.PullRequests.SingleOrDefaultAsync(entry => entry.Id == pr.Id, cancellation);

        if (row is null)
            db.PullRequests.Add(row = new PullRequest { Id = pr.Id, Vault = vault });

        Mirror(row, pr, details);

        await db.SaveChangesAsync(cancellation);
    }

    private static void Mirror(PullRequest row, AdoPullRequest pr, AdoPullRequestDetails details)
    {
        row.RepoId = pr.RepoId;
        row.RepoName = pr.RepoName;
        row.Title = pr.Title;
        row.DescriptionMd = pr.Description;
        row.Author = pr.Author;
        row.SourceRef = pr.SourceRef;
        row.TargetRef = pr.TargetRef;
        row.SourceCommit = pr.SourceCommit!;
        row.TargetCommit = pr.TargetCommit;
        row.Iteration = details.Iteration;
        row.IsDraft = pr.IsDraft;
        row.WorkItemIds = JsonSerializer.Serialize(details.WorkItemIds);
        row.Url = pr.Url;
        row.IsListed = true;
        row.AdoCreatedAt = pr.CreatedAt is null ? null : DateTime.Parse(pr.CreatedAt, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal);
        row.SyncedAt = DateTime.UtcNow;
    }

    // A PR that comes back to the list (e.g. you were added as a reviewer again) is listed again; its review stays as
    // it was.
    private async Task MarkListedAsync(List<AdoPullRequest> listed, CancellationToken cancellation)
    {
        var ids = listed.Select(pr => pr.Id).ToList();

        await db.PullRequests.Where(row => ids.Contains(row.Id) && !row.IsListed).ExecuteUpdateAsync(set => set.SetProperty(row => row.IsListed, true), cancellation);
    }

    // Drafts wait until they're published; a PR whose details wait for the next run gets its review then. No task: the
    // user starts the review.
    private async Task<int> AddNewReviewsAsync(List<AdoPullRequest> listed, CancellationToken cancellation)
    {
        var ids = listed.Where(pr => !pr.IsDraft).Select(pr => pr.Id).ToList();
        var unreviewed = await db.PullRequests.Where(pr => ids.Contains(pr.Id) && pr.CodeReview == null).Select(pr => pr.Id).ToListAsync(cancellation);

        db.CodeReviews.AddRange(unreviewed.Select(id => new CodeReview { PrId = id }));

        await db.SaveChangesAsync(cancellation);

        return unreviewed.Count;
    }

    // A PR that left the list: completed or abandoned, no longer yours to review, or its repo was deselected (`mine`:
    // your PRs before the repo filter, so the reason says which).
    private async Task<int> CloseUnlistedAsync(List<AdoPullRequest> listed, List<AdoPullRequest> mine, CancellationToken cancellation)
    {
        var listedIds = listed.Select(pr => pr.Id).ToList();
        var mineIds = mine.Select(pr => pr.Id).ToHashSet();
        var gone = await db.PullRequests.Where(row => row.IsListed && !listedIds.Contains(row.Id)).ToListAsync(cancellation);

        foreach (var pr in gone)
            await UnlistAsync(pr, mineIds.Contains(pr.Id) ? RepoNotSelectedReason : UnlistedReason, cancellation);

        return gone.Count;
    }

    private async Task UnlistAsync(PullRequest pr, string reason, CancellationToken cancellation)
    {
        pr.IsListed = false;
        pr.SyncedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);

        if (await db.CodeReviews.AnyAsync(review => review.PrId == pr.Id && review.Status == ReviewStatus.Active, cancellation))
            await ReviewClosing.CloseAsync(db, pr.Id, reason, Actor, cancellation);
    }
}
