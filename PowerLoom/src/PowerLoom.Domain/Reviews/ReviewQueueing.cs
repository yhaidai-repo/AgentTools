using PowerLoom.Persistence.Reviews;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Reviews;

// The user starts every review (user decision 2026-10-02): a review task for the PR's current commit, unless one is
// already open; a closed review is reopened. One exception (user decision 2026-10-16): the PR sync queues a follow-up
// when other reviewers comment on a PR that was reviewed. Both go to the pool (`agent:*`) like every other task.
public static class ReviewQueueing
{
    public const string Agent = "code-review";
    public const string ReviewerCommentsTrigger = "reviewer-comments";

    private const int TitleMax = 120;

    public static Task<Outcome<string>> QueueAsync(PowerLoomDbContext db, int prId, CancellationToken cancellation)
    {
        return QueueAsync(db, prId, new { prId }, cancellation);
    }

    // A review task in the pool like any other (any agent taking review tasks picks it up on its schedule); `threads`: the
    // ADO threads with new comments, which Better Review weighs first.
    public static Task<Outcome<string>> QueueForReviewerCommentsAsync(PowerLoomDbContext db, int prId, IReadOnlyList<int> threads, CancellationToken cancellation)
    {
        return QueueAsync(db, prId, new { prId, trigger = ReviewerCommentsTrigger, threads }, cancellation);
    }

    private static async Task<Outcome<string>> QueueAsync(PowerLoomDbContext db, int prId, object subject, CancellationToken cancellation)
    {
        var pr = await db.PullRequests.AsNoTracking().Where(row => row.Id == prId).Select(row => new { row.Vault, row.SourceCommit, row.Title, row.Origin }).SingleOrDefaultAsync(cancellation);

        if (pr is null)
            return Outcome<string>.Failure(Problem.NotFound("Unknown pull request."));

        // The review agent reads the branch from Azure DevOps; a branch only on the PC can be tested, not reviewed.
        if (pr.Origin == PullRequestOrigin.Pc)
            return Outcome<string>.Failure(Problem.Conflict("the branch is only on this PC: push it, code review reads it from Azure DevOps."));

        var open = await ReviewTasks.OpenTaskIdAsync(db, prId, cancellation);

        if (open is not null)
            return Outcome<string>.Failure(Problem.Conflict($"{open} is already queued for this pull request."));

        var id = await ItemIds.NextScopedAsync(db, $"CR-{prId}-", cancellation);
        var title = $"Review PR {prId}: {pr.Title}";

        db.LocalItems.Add(new LocalItem { Id = id, Kind = ItemKinds.Review, Title = title[..Math.Min(title.Length, TitleMax)], Status = ItemStatus.Open, Assignee = AgentStages.AnyAgent, Data = Data(subject, pr.SourceCommit), Vault = pr.Vault, HeldBy = "[]" });

        await db.SaveChangesAsync(cancellation);
        await db.CodeReviews.Where(review => review.PrId == prId).ExecuteUpdateAsync(set => set.SetProperty(review => review.Status, ReviewStatus.Active).SetProperty(review => review.ClosedReason, (string?)null).SetProperty(review => review.UpdatedAt, DateTime.UtcNow), cancellation);

        return Outcome<string>.Success(id);
    }

    // The subject's fields and the commit the task was queued for.
    private static string Data(object subject, string commit)
    {
        var data = JsonSerializer.SerializeToNode(subject)!.AsObject();

        data["commit"] = commit;

        return data.ToJsonString();
    }
}
