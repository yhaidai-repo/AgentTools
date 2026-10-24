using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Features.Tasks.TaskNotes.Models;
using PowerLoom.Infrastructure.Http;
using Wolverine.Http;

namespace PowerLoom.Features.Tasks.TaskNotes;

// The test task page's My notes box.
public static class TaskNotesEndpoints
{
    [WolverinePut("/api/items/{id}/user-notes")]
    public static async Task<Results<Ok<TaskUserNotes>, ProblemHttpResult>> Put(string id, SaveTaskNotesRequest request, TaskNotes notes, CancellationToken cancellation) => (await notes.SaveAsync(id, request, cancellation)).ToResult();
}
