using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Persistence.Reviews;

// Local only. Closing archives unresolved comments and cancels unfinished review tasks; it does not approve the PR.
// Closure and publication serialize on the review row. A running writer must finish before closure is accepted.
public static class ReviewClosing
{
    public static async Task<string?> CloseAsync(PowerLoomDbContext db, int prId, string? reason, string actor, CancellationToken cancellation)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellation);
        var review = await db.CodeReviews.FromSqlInterpolated($"SELECT * FROM code_review WHERE pr_id = {prId} FOR UPDATE").SingleOrDefaultAsync(cancellation);

        if (review is null)
            return "Unknown review.";

        await db.Entry(review).ReloadAsync(cancellation);

        var writers = await db.LocalItems.FromSqlInterpolated($"SELECT * FROM local_item WHERE kind = 'review' AND (data->>'prId')::int = {prId} AND status IN ('open', 'in-progress', 'blocked') FOR UPDATE").ToListAsync(cancellation);
        // A long-lived sync context may already track an older task state; the lock does not refresh tracked values.
        foreach (var writer in writers)
            await db.Entry(writer).ReloadAsync(cancellation);
        if (writers.Any(task => task.Status == ItemStatus.InProgress))
            return "A review writer is running; wait for it to finish before closing.";

        review.Status = ReviewStatus.Closed;
        review.ClosedReason = reason;
        review.UpdatedAt = DateTime.UtcNow;

        await db.ReviewComments.Where(comment => comment.PrId == prId && (comment.Status == ReviewCommentStatus.Open || comment.Status == ReviewCommentStatus.Answered))
            .ExecuteUpdateAsync(set => set.SetProperty(comment => comment.Status, ReviewCommentStatus.Withdrawn).SetProperty(comment => comment.UpdatedAt, review.UpdatedAt), cancellation);
        await db.SaveChangesAsync(cancellation);
        foreach (var task in writers.Where(task => task.Status is ItemStatus.Open or ItemStatus.Blocked))
            await ItemStatusChange.SetAsync(db, task, ItemStatus.Cancelled, actor, null, cancellation);
        await transaction.CommitAsync(cancellation);
        return null;
    }

}
