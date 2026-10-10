using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Persistence.Reviews;

// Closing a code review is local only: ADO isn't told. A queued review task is cancelled; a running one finishes, its
// comments still count (adoa's closeReview).
public static class ReviewClosing
{
    public static async Task CloseAsync(PowerLoomDbContext db, int prId, string? reason, string actor, CancellationToken cancellation)
    {
        var review = await db.CodeReviews.SingleOrDefaultAsync(row => row.PrId == prId, cancellation);

        if (review is null)
            return;

        review.Status = ReviewStatus.Closed;
        review.ClosedReason = reason;
        review.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);
        await CancelQueuedTasksAsync(db, prId, actor, cancellation);
    }

    private static async Task CancelQueuedTasksAsync(PowerLoomDbContext db, int prId, string actor, CancellationToken cancellation)
    {
        var queued = await db.LocalItems.Where(item => item.Kind == ItemKind.Review && item.Status == ItemStatus.Open).ToListAsync(cancellation);

        foreach (var task in queued.Where(task => PullRequestOf(task) == prId))
            await ItemStatusChange.SetAsync(db, task, ItemStatus.Cancelled, actor, null, cancellation);
    }

    // A review task's data: `{ prId, commit }`.
    private static int? PullRequestOf(LocalItem task)
    {
        if (task.Data is null)
            return null;

        using var data = JsonDocument.Parse(task.Data);

        return data.RootElement.TryGetProperty("prId", out var prId) && prId.ValueKind == JsonValueKind.Number ? prId.GetInt32() : null;
    }
}
