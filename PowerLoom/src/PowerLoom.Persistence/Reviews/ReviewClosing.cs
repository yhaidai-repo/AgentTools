using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Persistence.Reviews;

// Local only. Closure and agent publication serialize on the review row. Running writers and every unresolved
// comment (including answered nits) block closure. Queued work is cancelled only after closure is accepted.
public static class ReviewClosing
{
    public static async Task<string?> CloseAsync(PowerLoomDbContext db, int prId, string? reason, string actor, CancellationToken cancellation)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellation);
        var review = await db.CodeReviews.FromSqlInterpolated($"SELECT * FROM code_review WHERE pr_id = {prId} FOR UPDATE").SingleOrDefaultAsync(cancellation);

        if (review is null)
            return "Unknown review.";

        await db.Entry(review).ReloadAsync(cancellation);

        var unresolved = await db.ReviewComments.CountAsync(comment => comment.PrId == prId && (comment.Status == ReviewCommentStatus.Open || comment.Status == ReviewCommentStatus.Answered), cancellation);
        if (unresolved > 0)
            return $"{unresolved} unresolved review comment(s), including nits; resolve them before closing.";

        var writers = await db.LocalItems.FromSqlInterpolated($"SELECT * FROM local_item WHERE kind = 'review' AND (data->>'prId')::int = {prId} AND status IN ('open', 'in-progress') FOR UPDATE").ToListAsync(cancellation);
        if (writers.Any(task => task.Status == ItemStatus.InProgress))
            return "A review writer is running; wait for it to finish before closing.";

        review.Status = ReviewStatus.Closed;
        review.ClosedReason = reason;
        review.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);
        foreach (var task in writers.Where(task => task.Status == ItemStatus.Open))
            await ItemStatusChange.SetAsync(db, task, ItemStatus.Cancelled, actor, null, cancellation);
        await transaction.CommitAsync(cancellation);
        return null;
    }

}
