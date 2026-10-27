using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Reviews;

// The answer feeds the agent's next run on this PR (user decision 2026-10-02). An empty answer takes it back.
public static class ReviewComments
{
    // The comment's pull request.
    public static async Task<Outcome<int>> AnswerAsync(PowerLoomDbContext db, string commentId, string? answer, CancellationToken cancellation)
    {
        var prId = await db.ReviewComments.AsNoTracking().Where(row => row.Id == commentId).Select(row => (int?)row.PrId).SingleOrDefaultAsync(cancellation);
        if (prId is null)
            return Outcome<int>.Failure(Problem.NotFound("Unknown comment."));
        // Read the status only after serializing with agent decisions and closure; a stale human save must not
        // resurrect a comment that an agent fixed/withdrew while this request was waiting.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellation);
        var review = await db.CodeReviews.FromSqlInterpolated($"SELECT * FROM code_review WHERE pr_id = {prId.Value} FOR UPDATE").SingleOrDefaultAsync(cancellation);
        if (review is null)
            return Outcome<int>.Failure(Problem.NotFound("Unknown review."));
        var comment = await db.ReviewComments.SingleOrDefaultAsync(row => row.Id == commentId, cancellation);

        if (comment is null)
            return Outcome<int>.Failure(Problem.NotFound("Unknown comment."));

        await db.Entry(comment).ReloadAsync(cancellation);

        if (comment.Status is not (ReviewCommentStatus.Open or ReviewCommentStatus.Answered))
            return Outcome<int>.Failure(Problem.Conflict($"{commentId} is {new KebabCaseNameTranslator().TranslateMemberName(comment.Status.ToString())}; it takes no answer."));

        comment.AnswerMd = answer;
        comment.AnsweredAt = answer is null ? null : DateTime.UtcNow;
        comment.Status = answer is null ? ReviewCommentStatus.Open : ReviewCommentStatus.Answered;
        comment.UpdatedAt = DateTime.UtcNow;
        review.Status = ReviewStatus.Active;
        review.ClosedReason = null;
        review.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);
        await transaction.CommitAsync(cancellation);

        return Outcome<int>.Success(comment.PrId);
    }
}
