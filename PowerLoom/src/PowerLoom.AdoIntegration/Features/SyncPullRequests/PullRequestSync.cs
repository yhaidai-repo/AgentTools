using PowerLoom.Infrastructure.LocalBranches;
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
public sealed class PullRequestSync(PowerLoomDbContext db, AgentConfigReader agents, ILocalBranches localBranches)
{
    private const string Actor = "pull-requests";
    private const string UnlistedReason = "The PR was completed or abandoned in Azure DevOps, or you're no longer a reviewer.";
    // An agent's "Azure DevOps (read)" integration (the agents' ADO_INTEGRATION key), and the task type reviews are.
    private const string ReadsAdo = "adoTestCases";
    private const string ReviewTaskType = "review";
    private const string BranchGoneReason = "The branch was deleted in Azure DevOps.";
    private const string PcBranchGoneReason = "The branch is gone from this PC and isn't in Azure DevOps.";
    private const string RepoNotSelectedReason = "Its repo isn't selected for code review in Settings, or is disabled there.";

    public async Task<string> RunAsync(string vault, AdoSettings ado, PullRequestSettings settings, IAdoClient client, CancellationToken cancellation)
    {
        // A review deleted in PowerLoom stays deleted (user decision 2026-10-06).
        var deleted = (await db.DeletedPullRequests.Select(row => row.Id).ToListAsync(cancellation)).ToHashSet();
        var active = (await client.ListActivePullRequestsAsync(cancellation)).Where(pr => !deleted.Contains(pr.Id)).ToList();
        var mine = active.Where(pr => PullRequestFilter.IsMine(pr, ado.User)).ToList();
        var disabled = await RepoCatalog.DisabledIdsAsync(db, vault, cancellation);
        var listed = mine.Where(pr => PullRequestFilter.IsSelectedRepo(pr, settings.Repos) && !disabled.Contains(pr.RepoId)).Concat(await UserAddedAsync(vault, active, cancellation)).DistinctBy(pr => pr.Id).ToList();
        var changed = await ChangedAsync(listed, cancellation);
        var updated = changed.Take(settings.MaxPullRequestsPerRun).ToList();

        foreach (var pr in updated)
            await UpsertAsync(vault, client, pr, cancellation);

        await MarkListedAsync(listed, cancellation);

        var added = await AddNewReviewsAsync(listed, cancellation);
        var closed = await CloseUnlistedAsync(listed, mine, cancellation);
        var branches = await RefreshBranchReviewsAsync(vault, client, cancellation);
        var followUps = await QueueForReviewerCommentsAsync(listed, ado, client, cancellation);

        var branchNote = branches > 0 ? $", {branches} branch review(s) moved or closed" : "";

        return Summary(listed.Count, mine.Count - listed.Count, updated.Count, changed.Count - updated.Count, added, closed, followUps) + branchNote;
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

        PullRequestMirror.Mirror(row, pr, details);

        await db.SaveChangesAsync(cancellation);
    }


    // PRs the user added by their branch (user decision 2026-10-21) stay listed while they are active, whoever's they are.
    private async Task<List<AdoPullRequest>> UserAddedAsync(string vault, List<AdoPullRequest> active, CancellationToken cancellation)
    {
        var ids = await db.PullRequests.Where(row => row.Vault == vault && row.Origin == PullRequestOrigin.User).Select(row => row.Id).ToListAsync(cancellation);

        return active.Where(pr => ids.Contains(pr.Id) && pr.SourceCommit is not null).ToList();
    }

    // A branch review follows its branch: in Azure DevOps (a push moves its head, the list shows new commits), else on the
    // PC through DevHub (a branch pushed since becomes an ADO branch review); gone from both, it closes.
    private async Task<int> RefreshBranchReviewsAsync(string vault, IAdoClient client, CancellationToken cancellation)
    {
        var rows = await db.PullRequests.Where(row => row.Vault == vault && (row.Origin == PullRequestOrigin.Local || row.Origin == PullRequestOrigin.Pc) && row.IsListed).ToListAsync(cancellation);
        var changed = 0;

        foreach (var row in rows)
            changed += await RefreshBranchReviewAsync(row, client, cancellation) ? 1 : 0;

        return changed;
    }

    private async Task<bool> RefreshBranchReviewAsync(PullRequest row, IAdoClient client, CancellationToken cancellation)
    {
        var branch = BranchRefs.NameOf(row.SourceRef);
        var ado = await AdoHeadAsync(row, branch, client, cancellation);

        if (!ado.Known)
            return false;

        if (ado.Head is not null)
            return await MoveAsync(row, ado.Head, PullRequestOrigin.Local, cancellation);

        var onPc = await localBranches.FindAsync(row.Vault, row.RepoName, branch, cancellation);

        if (onPc.Head is not null)
            return await MoveAsync(row, onPc.Head, PullRequestOrigin.Pc, cancellation);

        // DevHub off: a PC branch is unknown, so it stays; an ADO branch that is gone closes as before.
        if (!onPc.Reachable && row.Origin == PullRequestOrigin.Pc)
            return false;

        await UnlistAsync(row, row.Origin == PullRequestOrigin.Pc ? PcBranchGoneReason : BranchGoneReason, cancellation);

        return true;
    }

    private static async Task<(bool Known, string? Head)> AdoHeadAsync(PullRequest row, string branch, IAdoClient client, CancellationToken cancellation)
    {
        try
        {
            return (true, await client.GetBranchHeadAsync(row.RepoId, branch, cancellation));
        }
        catch (AdoRequestException)
        {
            return (false, null);
        }
    }

    // A PC branch that got pushed gets its ADO page.
    private async Task<bool> MoveAsync(PullRequest row, string head, string origin, CancellationToken cancellation)
    {
        if (head == row.SourceCommit && origin == row.Origin)
            return false;

        if (origin == PullRequestOrigin.Local && row.Origin == PullRequestOrigin.Pc)
            row.Url = BranchRefs.WebUrl(await db.Repos.Where(repo => repo.Id == row.RepoId).Select(repo => repo.RemoteUrl).FirstOrDefaultAsync(cancellation) ?? "", BranchRefs.NameOf(row.SourceRef));

        row.SourceCommit = head;
        row.Origin = origin;
        row.SyncedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellation);

        return true;
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
        var gone = await db.PullRequests.Where(row => row.IsListed && !listedIds.Contains(row.Id) && row.Origin != PullRequestOrigin.Local && row.Origin != PullRequestOrigin.Pc).ToListAsync(cancellation);

        foreach (var pr in gone)
            await UnlistAsync(pr, mineIds.Contains(pr.Id) ? RepoNotSelectedReason : UnlistedReason, cancellation);

        return gone.Count;
    }

    // Other reviewers' new comments on a reviewed PR queue a follow-up review task in the pool (user decision 2026-10-16),
    // while an enabled agent taking review tasks has Azure DevOps (read) on (null: none would read the comments). No new comment, no
    // run: a push alone or an edited comment queues nothing (user decision 2026-10-16). Each comment counts once: the review remembers what the sync saw, so a run
    // that fails doesn't queue again. The first check of a review counts only comments posted after it was reviewed.
    // Your comments and the PR author's queue nothing; a PR with a review task open waits for it to finish.
    private async Task<FollowUps?> QueueForReviewerCommentsAsync(List<AdoPullRequest> listed, AdoSettings ado, IAdoClient client, CancellationToken cancellation)
    {
        var readers = (await agents.ListAsync(cancellation)).Where(agent => agent.Enabled && agent.Handles.Contains(ReviewTaskType) && agent.Integrations.Contains(ReadsAdo));

        if (!readers.Any())
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
