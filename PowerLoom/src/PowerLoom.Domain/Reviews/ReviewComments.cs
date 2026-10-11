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
        var comment = await db.ReviewComments.SingleOrDefaultAsync(row => row.Id == commentId, cancellation);

        if (comment is null)
            return Outcome<int>.Failure(Problem.NotFound("Unknown comment."));

        if (comment.Status is not (ReviewCommentStatus.Open or ReviewCommentStatus.Answered))
            return Outcome<int>.Failure(Problem.Conflict($"{commentId} is {new KebabCaseNameTranslator().TranslateMemberName(comment.Status.ToString())}; it takes no answer."));

        comment.AnswerMd = answer;
        comment.AnsweredAt = answer is null ? null : DateTime.UtcNow;
        comment.Status = answer is null ? ReviewCommentStatus.Open : ReviewCommentStatus.Answered;
        comment.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);

        return Outcome<int>.Success(comment.PrId);
    }
}
