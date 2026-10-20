using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Tasks;
using PowerLoom.Domain.Reviews;
using PowerLoom.Features.Reviews.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Reviews;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Reviews;

// The Reviews page and a review's page (user decision 2026-10-06: the same actions on the grid and the page): each
// selected pull request in turn, the refusals reported together. Local only: ADO is never told.
public static class ReviewsEndpoints
{
    private const string Actor = "human";

    // A full review of the PR's current commit; the web then dispatches the code-review agent.
    [WolverinePost("/api/reviews/queue")]
    public static async Task<Ok<ReviewsResult>> Queue(ReviewIds request, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var result = new ReviewsResult([], []);

        foreach (var prId in request.PrIds.Distinct())
            Collect(result, prId, await ReviewQueueing.QueueAsync(db, prId, cancellation));

        return TypedResults.Ok(result);
    }

    // Start test (user decision 2026-10-21): test tasks for the PRs' linked PBIs; the web then dispatches the test agent.
    [WolverinePost("/api/reviews/test")]
    public static async Task<Ok<ReviewsResult>> Test(ReviewIds request, ReviewTesting testing, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var result = await testing.StartAsync(request.PrIds, cancellation);

        foreach (var pbiId in await PbisOfAsync(db, result, cancellation))
            await PbiChanges.PublishAsync(db, bus, pbiId, Actor, cancellation);

        return TypedResults.Ok(result);
    }

    [WolverinePost("/api/reviews/close")]
    public static async Task<Ok<ReviewsResult>> Close(CloseReviewsRequest request, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var result = new ReviewsResult([], []);

        foreach (var prId in request.PrIds.Distinct())
        {
            await ReviewClosing.CloseAsync(db, prId, string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(), Actor, cancellation);
            result.Done.Add(new ReviewOutcome(prId, "closed"));
        }

        return TypedResults.Ok(result);
    }

    [WolverineDelete("/api/reviews")]
    public static async Task<Ok<ReviewsResult>> Delete(ReviewIds request, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var result = new ReviewsResult([], []);

        foreach (var prId in request.PrIds.Distinct())
            Collect(result, prId, await ReviewDeletion.DeleteAsync(db, prId, cancellation));

        return TypedResults.Ok(result);
    }

    [WolverinePost("/api/review-comments/{id}/answer")]
    public static async Task<Results<Ok<AnsweredComment>, ProblemHttpResult>> Answer(string id, AnswerRequest request, PowerLoomDbContext db, CancellationToken cancellation)
    {
        var answer = string.IsNullOrWhiteSpace(request.Answer) ? null : request.Answer.Trim();
        var answered = await ReviewComments.AnswerAsync(db, id, answer, cancellation);

        return answered.Ok ? TypedResults.Ok(new AnsweredComment(answered.Value, answer is not null)) : answered.Problem!.ToProblemResult();
    }

    private static async Task<List<int>> PbisOfAsync(PowerLoomDbContext db, ReviewsResult result, CancellationToken cancellation)
    {
        var taskIds = result.Done.Select(done => done.Value).ToList();

        return await db.LocalItems.Where(item => taskIds.Contains(item.Id) && item.PbiId != null).Select(item => item.PbiId!.Value).Distinct().ToListAsync(cancellation);
    }

    private static void Collect(ReviewsResult result, int prId, Outcome<string> outcome)
    {
        if (outcome.Ok)
            result.Done.Add(new ReviewOutcome(prId, outcome.Value!));
        else
            result.Refused.Add($"PR {prId}: {outcome.Problem!.Detail}");
    }
}
