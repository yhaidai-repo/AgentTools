using Microsoft.AspNetCore.Mvc;
using PowerLoom.Contracts;

namespace PowerLoom.Infrastructure.Http;

// Expected failures leave an endpoint as ProblemDetails with the problem's status.
public static class OutcomeResults
{
    public static IResult ToResult<T>(this Outcome<T> outcome)
        where T : notnull
    {
        return outcome.Ok ? Results.Ok(outcome.Value) : Results.Problem(outcome.Problem.Detail, statusCode: outcome.Problem.Status);
    }

    public static ProblemDetails ToProblemDetails(this Problem problem)
    {
        return new ProblemDetails { Status = problem.Status, Detail = problem.Detail };
    }
}
