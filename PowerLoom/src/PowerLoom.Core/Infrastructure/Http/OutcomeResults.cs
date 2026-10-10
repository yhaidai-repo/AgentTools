using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Contracts;

namespace PowerLoom.Infrastructure.Http;

// Expected failures leave an endpoint as ProblemDetails with the problem's status.
public static class OutcomeResults
{
    // Typed results: the OpenAPI document shows the value and the ProblemDetails, not an opaque IResult.
    public static Results<Ok<T>, ProblemHttpResult> ToResult<T>(this Outcome<T> outcome)
        where T : notnull
    {
        return outcome.Ok ? TypedResults.Ok(outcome.Value) : TypedResults.Problem(outcome.Problem.Detail, statusCode: outcome.Problem.Status);
    }

    public static ProblemDetails ToProblemDetails(this Problem problem)
    {
        return new ProblemDetails { Status = problem.Status, Detail = problem.Detail };
    }
}
