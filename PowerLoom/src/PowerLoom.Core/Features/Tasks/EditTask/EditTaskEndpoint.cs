using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Features.Tasks.EditTask.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Tasks.EditTask;

// Edit on an agent task's page (and task_edit for chats); the PBI's notes show the new text.
public static class EditTaskEndpoint
{
    private const string Actor = "human";

    [WolverinePut("/api/tasks/{id}")]
    public static async Task<Results<Ok<EditedTask>, ProblemHttpResult>> Put(string id, EditTaskRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        var edited = await TaskEdit.SaveAsync(db, id, request, cancellation);

        if (edited.Ok)
            await PbiChanges.PublishAsync(db, bus, request.AdoId, Actor, cancellation);

        return edited.ToResult();
    }
}
