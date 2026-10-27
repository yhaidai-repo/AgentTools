using System.Text.Json.Nodes;
using PowerLoom.Contracts;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Tasks.CreateTask;
using PowerLoom.Features.Tasks.EditTask.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Tasks.EditTask;

// Editing an agent task's title, description and acceptance criteria (user decision 2026-10-26): any time it isn't
// running, so a run never works on text that changes under it. The criteria are `doneWhen`, and `goal` where the task has
// one (research reads it as the task's goal). Editing doesn't run it again: Re-run does.
public static class TaskEdit
{
    private static readonly ItemStatus[] Editable = [ItemStatus.Open, ItemStatus.Blocked, ItemStatus.Done];

    public static async Task<Outcome<EditedTask>> SaveAsync(PowerLoomDbContext db, string id, EditTaskRequest request, CancellationToken cancellation)
    {
        var task = await ItemScope.FindAsync(db, request.AdoId, id, cancellation);
        var problem = task is null || !TaskRerun.IsAgentTask(task) ? Problem.NotFound($"{id} isn't an agent task of {ItemScope.PbiLabel(request.AdoId)}.") : StateProblem(task) ?? FieldsProblem(request);

        if (problem is not null)
            return Outcome<EditedTask>.Failure(problem);

        task!.Title = request.Title.Trim();
        task.Body = request.Description.Trim();
        task.Data = WithCriteria(task.Data, request.AcceptanceCriteria.Trim());
        await db.SaveChangesAsync(cancellation);

        return Outcome<EditedTask>.Success(new EditedTask(task.Id));
    }

    private static Problem? StateProblem(LocalItem task)
    {
        if (task.Status == ItemStatus.InProgress)
            return Problem.Conflict($"{task.Id} is running: stop it or wait for the run to end, then edit it.");

        return Editable.Contains(task.Status) ? null : Problem.Conflict($"{task.Id} is {task.Status.ToString().ToLowerInvariant()}: only open, blocked or done tasks can be edited.");
    }

    private static Problem? FieldsProblem(EditTaskRequest request)
    {
        return TaskCreation.LengthProblem("Title", request.Title, TaskCreation.TitleMax)
            ?? TaskCreation.LengthProblem("Description", request.Description, TaskCreation.TextMax)
            ?? TaskCreation.LengthProblem("Acceptance criteria", request.AcceptanceCriteria, TaskCreation.TextMax);
    }

    private static string WithCriteria(string? data, string criteria)
    {
        var json = JsonNode.Parse(data ?? "{}")?.AsObject() ?? [];

        json["doneWhen"] = criteria;

        if (json.ContainsKey("goal"))
            json["goal"] = criteria;

        return json.ToJsonString();
    }
}
