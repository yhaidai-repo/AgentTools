using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Domain.Repos;
using PowerLoom.Domain.Reviews;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Reviews;

namespace PowerLoom.AdoIntegration.Features.SyncPullRequests;

// One check of the vault's pull requests; the database only (the review's notes come from the review runs).
public sealed class PullRequestSync(PowerLoomDbContext db, AgentConfigReader agents)
{
    private const string Actor = "pull-requests";
    private const string UnlistedReason = "The PR was completed or abandoned in Azure DevOps, or you're no longer a reviewer.";
    // Better Review's "Azure DevOps (read)" integration (the agents' ADO_INTEGRATION key).
    private const string ReadsAdo = "adoTestCases";
    private const string RepoNotSelectedReason = "Its repo isn't selected for code review in Settings, or is disabled there.";

    public async Task<string> RunAsync(string vault, AdoSettings ado, PullRequestSettings settings, IAdoClient client, CancellationToken cancellation)
    {
        // A review deleted in PowerLoom stays deleted (user decision 2026-10-06).
        var deleted = (await db.DeletedPullRequests.Select(row => row.Id).ToListAsync(cancellation)).ToHashSet();
        var mine = (await client.ListActivePullRequestsAsync(cancellation)).Where(pr => PullRequestFilter.IsMine(pr, ado.User) && !deleted.Contains(pr.Id)).ToList();
        var disabled = await RepoCatalog.DisabledIdsAsync(db, vault, cancellation);
        var listed = mine.Where(pr => PullRequestFilter.IsSelectedRepo(pr, settings.Repos) && !disabled.Contains(pr.RepoId)).ToList();
        var changed = await ChangedAsync(listed, cancellation);
        var updated = changed.Take(settings.MaxPullRequestsPerRun).ToList();

        foreach (var pr in updated)
            await UpsertAsync(vault, client, pr, cancellation);

        await MarkListedAsync(listed, cancellation);

        var added = await AddNewReviewsAsync(listed, cancellation);
        var closed = await CloseUnlistedAsync(listed, mine, cancellation);
        var followUps = await QueueForReviewerCommentsAsync(listed, ado, client, cancellation);

        return Summary(listed.Count, mine.Count - listed.Count, updated.Count, changed.Count - updated.Count, added, closed, followUps);
    }

    private static string Summary(int listed, int notSelected, int updated, int waiting, int added, int closed, FollowUps? followUps)
    {
        var notSelectedNote = notSelected > 0 ? $" ({notSelected} more in repos not selected or disabled)" : "";
        var waitingNote = waiting > 0 ? $" ({waiting} next run)" : "";
        var failedNote = followUps is { Failed: > 0 } ? $" ({followUps.Failed} PR(s) whose threads couldn't be read)" : "";
        var followUpNote = followUps is null ? "" : $", {followUps.Queued} follow-up review(s) for reviewer comments{failedNote}";

        return $"{listed} PR(s) you review{notSelectedNote}, {updated} updated{waitingNote}, {added} new review(s), {closed} closed{followUpNote}";
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

    // A PR that left the list: completed or abandoned, no longer yours to review, or its repo was deselected or disabled
    // (`mine`: your PRs before the repo filter, so the reason says which).
    private async Task<int> CloseUnlistedAsync(List<AdoPullRequest> listed, List<AdoPullRequest> mine, CancellationToken cancellation)
    {
        var listedIds = listed.Select(pr => pr.Id).ToList();
        var mineIds = mine.Select(pr => pr.Id).ToHashSet();
        var gone = await db.PullRequests.Where(row => row.IsListed && !listedIds.Contains(row.Id)).ToListAsync(cancellation);

        foreach (var pr in gone)
            await UnlistAsync(pr, mineIds.Contains(pr.Id) ? RepoNotSelectedReason : UnlistedReason, cancellation);

        return gone.Count;
    }

    // Other reviewers' new comments on a reviewed PR queue a Better Review follow-up (user decision 2026-10-16), while
    // Better Review is on and reads Azure DevOps (null: it's off, or a run couldn't read the comments). No new comment, no
    // run: a push alone or an edited comment queues nothing (user decision 2026-10-16). Each comment counts once: the review remembers what the sync saw, so a run
    // that fails doesn't queue again. The first check of a review counts only comments posted after it was reviewed.
    // Your comments and the PR author's queue nothing; a PR with a review task open waits for it to finish.
    private async Task<FollowUps?> QueueForReviewerCommentsAsync(List<AdoPullRequest> listed, AdoSettings ado, IAdoClient client, CancellationToken cancellation)
    {
        var agent = await agents.ReadAsync(ReviewQueueing.BetterReviewAgent, cancellation);

        if (agent is not { Enabled: true } || !agent.Integrations.Contains(ReadsAdo))
            return null;

        var prs = listed.Where(pr => !pr.IsDraft).ToDictionary(pr => pr.Id);
        var ids = prs.Keys.ToList();
        var reviews = await db.CodeReviews.Where(review => ids.Contains(review.PrId) && review.Status == ReviewStatus.Active && review.ReviewedAt != null).ToListAsync(cancellation);
        var followUps = new FollowUps();

        foreach (var review in reviews)
        {
            if (await ReviewTasks.OpenTaskIdAsync(db, review.PrId, cancellation) is not null)
                continue;

            var pr = prs[review.PrId];
            IReadOnlyList<AdoThreadComment> comments;

            try
            {
                comments = await client.GetPullRequestCommentsAsync(pr.RepoId, pr.Id, cancellation);
            }
            catch (AdoRequestException)
            {
                followUps.Failed++;

                continue;
            }

            var seen = SeenComments(review.SeenComments);
            var fresh = comments.Where(comment => IsOtherReviewer(comment, pr, ado.User) && (seen is null ? comment.PublishedAt > review.ReviewedAt : !seen.Contains(comment.Key))).ToList();
            var all = (seen ?? []).Union(comments.Select(comment => comment.Key)).ToList();

            if (seen is null || all.Count != seen.Count)
            {
                review.SeenComments = JsonSerializer.Serialize(all);
                await db.SaveChangesAsync(cancellation);
            }

            if (fresh.Count > 0 && (await ReviewQueueing.QueueForReviewerCommentsAsync(db, pr.Id, fresh.Select(comment => comment.ThreadId).Distinct().ToList(), cancellation)).Ok)
                followUps.Queued++;
        }

        return followUps;
    }

    private static List<string>? SeenComments(string? json) => json is null ? null : JsonSerializer.Deserialize<List<string>>(json);

    private static bool IsOtherReviewer(AdoThreadComment comment, AdoPullRequest pr, string user)
    {
        return comment.Author is not null && !Same(comment.Author, user) && (pr.Author is null || !Same(comment.Author, pr.Author));
    }

    private static bool Same(string a, string b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);

    private sealed class FollowUps
    {
        public int Queued { get; set; }

        public int Failed { get; set; }
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
