using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Reviews;

// The user starts every review (user decision 2026-10-02): a review task for the PR's current commit, unless one is
// already open; a closed review is reopened. One exception (user decision 2026-10-16): the PR sync queues a Better Review
// follow-up when other reviewers comment on a PR that was reviewed.
public static class ReviewQueueing
{
    public const string Agent = "code-review";
    public const string BetterReviewAgent = "better-review";
    public const string ReviewerCommentsTrigger = "reviewer-comments";

    private const int TitleMax = 120;

    public static Task<Outcome<string>> QueueAsync(PowerLoomDbContext db, int prId, CancellationToken cancellation)
    {
        return QueueAsync(db, prId, AgentStages.AnyAgent, new { prId }, cancellation);
    }

    // For Better Review only (Code review doesn't read the threads); `threads`: the ADO threads with new comments.
    public static Task<Outcome<string>> QueueForReviewerCommentsAsync(PowerLoomDbContext db, int prId, IReadOnlyList<int> threads, CancellationToken cancellation)
    {
        return QueueAsync(db, prId, AgentStages.AssigneeOf(BetterReviewAgent), new { prId, trigger = ReviewerCommentsTrigger, threads }, cancellation);
    }

    private static async Task<Outcome<string>> QueueAsync(PowerLoomDbContext db, int prId, string assignee, object subject, CancellationToken cancellation)
    {
        var pr = await db.PullRequests.AsNoTracking().Where(row => row.Id == prId).Select(row => new { row.Vault, row.SourceCommit, row.Title }).SingleOrDefaultAsync(cancellation);

        if (pr is null)
            return Outcome<string>.Failure(Problem.NotFound("Unknown pull request."));

        var open = await ReviewTasks.OpenTaskIdAsync(db, prId, cancellation);

        if (open is not null)
            return Outcome<string>.Failure(Problem.Conflict($"{open} is already queued for this pull request."));

        var id = await ItemIds.NextScopedAsync(db, $"CR-{prId}-", cancellation);
        var title = $"Review PR {prId}: {pr.Title}";

        db.LocalItems.Add(new LocalItem { Id = id, Kind = ItemKind.Review, Title = title[..Math.Min(title.Length, TitleMax)], Status = ItemStatus.Open, Assignee = assignee, Data = Data(subject, pr.SourceCommit), Vault = pr.Vault, HeldBy = "[]" });

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
