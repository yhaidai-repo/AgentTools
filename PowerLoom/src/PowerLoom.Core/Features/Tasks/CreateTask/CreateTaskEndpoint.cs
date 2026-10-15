using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Contracts;
using PowerLoom.Features.Tasks.CreateTask.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Tasks.CreateTask;

// Tasks → New task → Task… (user decision 2026-10-14). A task on a PBI updates its status and notes; the dispatcher
// starts it on the next schedule of an agent that takes its type.
public static class CreateTaskEndpoint
{
    private const string DefaultActor = "human";

    [WolverinePost("/api/tasks")]
    public static async Task<Results<Ok<CreatedTask>, ProblemHttpResult>> Post(CreateTaskRequest request, TaskCreation creation, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        if (!await db.VaultExistsAsync(request.Vault, cancellation))
            return Problem.NotFound($"{request.Vault} isn't a vault.").ToProblemResult();

        var task = NewTaskOf(request);

        if (!task.Ok)
            return task.Problem.ToProblemResult();

        var created = await creation.CreateAsync(task.Value, cancellation);

        if (!created.Ok)
            return created.Problem.ToProblemResult();

        await PbiChanges.PublishAsync(db, bus, created.Value.PbiId, ActorOf(request), cancellation);

        return TypedResults.Ok(created.Value);
    }

    private static Outcome<NewTask> NewTaskOf(CreateTaskRequest request)
    {
        var pbiProblem = OptionalPbi.Parse(request.Pbi, out var pbiId);

        if (pbiProblem is not null)
            return Outcome<NewTask>.Failure(pbiProblem);

        return Outcome<NewTask>.Success(new NewTask(request.Vault, (request.Type ?? "").Trim(), request.Title ?? "", request.Description ?? "", request.AcceptanceCriteria ?? "", pbiId, request.Repos ?? []));
    }

    private static string ActorOf(CreateTaskRequest request) => string.IsNullOrWhiteSpace(request.Actor) ? DefaultActor : request.Actor.Trim();
}
