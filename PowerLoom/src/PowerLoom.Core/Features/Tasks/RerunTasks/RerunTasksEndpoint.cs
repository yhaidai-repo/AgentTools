using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Tasks.RerunTasks.Models;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Tasks.RerunTasks;

// "Re-run" on a task and "Re-run selected" on the Runs page: each task reopens once; the dispatcher starts them on
// their agents' next schedule or "Run now".
public static class RerunTasksEndpoint
{
    private const string Actor = "human";

    [WolverinePost("/api/tasks/rerun")]
    public static async Task<Ok<RerunResult>> Post(RerunRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var result = new RerunResult([], []);

        foreach (var task in request.Tasks.DistinctBy(task => task.ItemId))
            await RerunOneAsync(task, db, bus, result, cancellation);

        return TypedResults.Ok(result);
    }

    private static async Task RerunOneAsync(TaskRef task, PowerLoomDbContext db, IMessageBus bus, RerunResult result, CancellationToken cancellation)
    {
        var reopened = await TaskRerun.RerunAsync(db, task.AdoId, task.ItemId, task.StartOver, cancellation);

        if (!reopened.Ok)
        {
            result.Refused.Add(reopened.Problem!.Detail);

            return;
        }

        result.Reopened.Add(reopened.Value!);

        await PbiChanges.PublishAsync(db, bus, task.AdoId, Actor, cancellation);
    }
}
