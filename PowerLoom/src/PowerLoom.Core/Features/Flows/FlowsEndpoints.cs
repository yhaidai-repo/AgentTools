using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Features.Flows.Models;
using PowerLoom.Infrastructure.Http;
using Wolverine.Http;

namespace PowerLoom.Features.Flows;

// The Flow app's writes (PowerLoom Flow phase 1): flows are saved, deleted and run here; the app reads them from the
// database as the web does. A run starts the engine (FlowAdvancer) that turns the execution into tasks.
public static class FlowsEndpoints
{
    [WolverinePut("/api/flows")]
    public static async Task<Results<Ok<SavedFlow>, ProblemHttpResult>> Save(FlowInput input, FlowCatalogue catalogue, CancellationToken cancellation)
    {
        var saved = await catalogue.SaveAsync(input, cancellation);

        return saved.Ok ? TypedResults.Ok(FlowCatalogue.Summary(saved.Value)) : saved.Problem.ToProblemResult();
    }

    [WolverineDelete("/api/flows/{id}")]
    public static async Task<Results<Ok<DeletedFlow>, ProblemHttpResult>> Delete(string id, [FromServices] FlowCatalogue catalogue, CancellationToken cancellation)
    {
        var deleted = await catalogue.DeleteAsync(id, cancellation);

        return deleted.Ok ? TypedResults.Ok(new DeletedFlow(id, deleted.Value)) : deleted.Problem.ToProblemResult();
    }

    [WolverinePost("/api/flows/{id}/run")]
    public static async Task<Results<Ok<FlowExecutionView>, ProblemHttpResult>> Run(string id, RunFlowInput input, FlowExecutions executions, CancellationToken cancellation)
    {
        var started = await executions.RunAsync(id, input, cancellation);

        return started.Ok ? TypedResults.Ok(await executions.ViewAsync(started.Value!, cancellation)) : started.Problem.ToProblemResult();
    }

    [WolverinePost("/api/flow-executions/{id}/cancel")]
    // No body: the service is marked, or Wolverine would read it from the request.
    public static async Task<Results<Ok<FlowExecutionView>, ProblemHttpResult>> Cancel(string id, [FromServices] FlowExecutions executions, CancellationToken cancellation)
    {
        var cancelled = await executions.CancelAsync(id, cancellation);

        return cancelled.Ok ? TypedResults.Ok(await executions.ViewAsync(cancelled.Value!, cancellation)) : cancelled.Problem.ToProblemResult();
    }
}
