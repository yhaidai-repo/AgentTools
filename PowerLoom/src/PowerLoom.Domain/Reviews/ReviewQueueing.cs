using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Reviews;

// The user starts every review (user decision 2026-10-02): a review task for the PR's current commit, unless one is
// already open; a closed review is reopened.
public static class ReviewQueueing
{
    public const string Agent = "code-review";

    private const int TitleMax = 120;

    public static async Task<Outcome<string>> QueueAsync(PowerLoomDbContext db, int prId, CancellationToken cancellation)
    {
        var pr = await db.PullRequests.AsNoTracking().Where(row => row.Id == prId).Select(row => new { row.Vault, row.SourceCommit, row.Title }).SingleOrDefaultAsync(cancellation);

        if (pr is null)
            return Outcome<string>.Failure(Problem.NotFound("Unknown pull request."));

        var open = await ReviewTasks.OpenTaskIdAsync(db, prId, cancellation);

        if (open is not null)
            return Outcome<string>.Failure(Problem.Conflict($"{open} is already queued for this pull request."));

        var id = await ItemIds.NextScopedAsync(db, $"CR-{prId}-", cancellation);
        var title = $"Review PR {prId}: {pr.Title}";

        db.LocalItems.Add(new LocalItem { Id = id, Kind = ItemKind.Review, Title = title[..Math.Min(title.Length, TitleMax)], Status = ItemStatus.Open, Assignee = AgentStages.AnyAgent, Data = JsonSerializer.Serialize(new { prId, commit = pr.SourceCommit }), Vault = pr.Vault, HeldBy = "[]" });

        await db.SaveChangesAsync(cancellation);
        await db.CodeReviews.Where(review => review.PrId == prId).ExecuteUpdateAsync(set => set.SetProperty(review => review.Status, ReviewStatus.Active).SetProperty(review => review.ClosedReason, (string?)null).SetProperty(review => review.UpdatedAt, DateTime.UtcNow), cancellation);

        return Outcome<string>.Success(id);
    }
}
