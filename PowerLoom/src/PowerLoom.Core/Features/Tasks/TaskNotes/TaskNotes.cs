using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Tasks.TaskNotes.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Tasks.TaskNotes;

// The user's own notes on a test task (user decision 2026-10-21): kept in the task's data as `userNotes`, editable at
// any time; the Autotest agent reads the current notes on every run.
public sealed class TaskNotes(PowerLoomDbContext db)
{
    public const string Property = "userNotes";
    private const int TextMax = 8_000;

    public async Task<Outcome<TaskUserNotes>> SaveAsync(string id, SaveTaskNotesRequest request, CancellationToken cancellation)
    {
        var item = await db.LocalItems.SingleOrDefaultAsync(row => row.Id == id, cancellation);
        var problem = item is null ? Problem.NotFound($"No item {id}.") : RequestProblem(item.Kind, request);

        if (problem is not null)
            return Outcome<TaskUserNotes>.Failure(problem);

        var data = JsonNode.Parse(item!.Data ?? "{}")?.AsObject() ?? [];
        var current = data[Property]?.GetValue<string>() ?? "";

        if (request.LoadedText is not null && request.LoadedText != current)
            return Outcome<TaskUserNotes>.Failure(Problem.Conflict("The notes changed since this page loaded; reload it and save again."));

        var text = request.Text.Trim();

        data[Property] = text;
        item.Data = data.ToJsonString();
        await db.SaveChangesAsync(cancellation);

        return Outcome<TaskUserNotes>.Success(new TaskUserNotes(id, text));
    }

    private static Problem? RequestProblem(ItemKind kind, SaveTaskNotesRequest request)
    {
        if (kind != ItemKind.Test)
            return Problem.Invalid("Notes are kept on test tasks only.");

        return request.Text.Length > TextMax ? Problem.Invalid($"Notes: at most {TextMax} characters.") : null;
    }
}
