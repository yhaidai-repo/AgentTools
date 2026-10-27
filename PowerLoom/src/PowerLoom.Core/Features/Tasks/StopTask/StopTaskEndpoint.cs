using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Contracts;
using PowerLoom.Features.Tasks.StopTask.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Runner;
using Wolverine.Http;

namespace PowerLoom.Features.Tasks.StopTask;

// Stop on a running run (user decision 2026-10-26): the runner ends the agent at once; the run keeps what it has (its
// result, or its last words as a partial one) and its task is blocked until the user Re-runs it. The saga ends with the
// run's callback as for any other run.
public static class StopTaskEndpoint
{
    [WolverinePost("/api/tasks/{id}/stop")]
    public static async Task<Results<Ok<StoppedTask>, ProblemHttpResult>> Post(string id, IRunnerClient runner, CancellationToken cancellation)
    {
        try
        {
            return await runner.StopAsync(id, cancellation)
                ? TypedResults.Ok(new StoppedTask(id))
                : Problem.Conflict($"{id} isn't running now: its run already ended, or it waits for the runner.").ToProblemResult();
        }
        catch (HttpRequestException error)
        {
            return new Problem(502, $"The agent-runner didn't answer: {error.Message}").ToProblemResult();
        }
    }
}
