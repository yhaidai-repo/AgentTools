using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Repos;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Tasks.CreateTask.Models;
using PowerLoom.Features.Tasks.Schedules;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Tasks.CreateTask;

// Tasks the user creates (user decision 2026-10-14): any enabled agent that takes the type works on it, like the tasks
// agents create for each other. The description is the body; the acceptance criteria are `doneWhen`, and `goal` too,
// which research reads as the task's goal (as on agent-created tasks).
public sealed class TaskCreation(PowerLoomDbContext db)
{
    private const int TitleMax = 120;
    private const int TextMax = 4_000;
    private const string CreatedBy = "user";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // Refinement and design run once per PBI at a time, as the pipeline creates them; research comes in numbers. Research
    // without a PBI is a goal (GT). The vault review works on the task's vault (user decision 2026-10-18).
    public static readonly IReadOnlyList<UserTaskType> Types =
    [
        new("refinement", ItemKind.Refinement, PbiUse.Required, OnePerPbi: true, NoPbiPrefix: null),
        new("research", ItemKind.Research, PbiUse.Optional, OnePerPbi: false, NoPbiPrefix: "GT"),
        new("design", ItemKind.Design, PbiUse.Required, OnePerPbi: true, NoPbiPrefix: null),
        new("docs", ItemKind.Docs, PbiUse.None, OnePerPbi: false, NoPbiPrefix: "WT"),
        new("vault-review", ItemKind.VaultReview, PbiUse.None, OnePerPbi: false, NoPbiPrefix: "VR"),
    ];

    public async Task<Outcome<CreatedTask>> CreateAsync(NewTask task, CancellationToken cancellation)
    {
        var problem = await ProblemAsync(task, cancellation) ?? await OpenTaskProblemAsync(task, cancellation);

        if (problem is not null)
            return Outcome<CreatedTask>.Failure(problem);

        var type = TypeOf(task)!;
        var id = await NextIdAsync(task, type, cancellation);

        db.LocalItems.Add(new LocalItem { Id = id, Kind = type.Kind, PbiId = task.PbiId, Vault = task.Vault, Title = task.Title.Trim(), Status = ItemStatus.Open, Assignee = AgentStages.AnyAgent, Body = task.Description.Trim(), Data = DataOf(task, type), HeldBy = "[]" });
        await db.SaveChangesAsync(cancellation);

        return Outcome<CreatedTask>.Success(new CreatedTask(id, task.PbiId));
    }

    // Everything but a waiting task of the same type on the PBI: a schedule is saved before its ticks meet one.
    public async Task<Problem?> ProblemAsync(NewTask task, CancellationToken cancellation)
    {
        var type = TypeOf(task);

        if (type is null)
            return Problem.Invalid($"Unknown task type {task.Type}; one of: {string.Join(", ", Types.Select(known => known.Name))}.");

        return FieldsProblem(task, type) ?? await ContextProblemAsync(task, type, cancellation);
    }

    private static UserTaskType? TypeOf(NewTask task) => Types.FirstOrDefault(candidate => candidate.Name == task.Type);

    private static Problem? FieldsProblem(NewTask task, UserTaskType type)
    {
        return LengthProblem("Title", task.Title, TitleMax)
            ?? LengthProblem("Description", task.Description, TextMax)
            ?? LengthProblem("Acceptance criteria", task.AcceptanceCriteria, TextMax)
            ?? PbiProblem(task, type);
    }

    private static Problem? LengthProblem(string field, string text, int max)
    {
        var length = text.Trim().Length;

        return length is 0 || length > max ? Problem.Invalid($"{field}: 1 to {max} characters required.") : null;
    }

    private static Problem? PbiProblem(NewTask task, UserTaskType type)
    {
        if (type.Pbi == PbiUse.Required && task.PbiId is null)
            return Problem.Invalid($"A {type.Name} task needs a PBI.");

        return type.Pbi == PbiUse.None && task.PbiId is not null ? Problem.Invalid($"A {type.Name} task takes no PBI.") : null;
    }

    // Each type is checked against what it works on: its PBI, or the repos it may read.
    private async Task<Problem?> ContextProblemAsync(NewTask task, UserTaskType type, CancellationToken cancellation)
    {
        if (task.PbiId is not null)
            return await PbiProblemAsync(task.Vault, task.PbiId.Value, cancellation);

        var unknownRepos = await RepoCatalog.UnknownReposProblemAsync(db, task.Vault, task.Repos, cancellation);

        return unknownRepos is null ? null : Problem.Invalid(unknownRepos);
    }

    private async Task<Problem?> PbiProblemAsync(string vault, int adoId, CancellationToken cancellation)
    {
        var isInVault = await db.WorkItems.AsNoTracking().AnyAsync(row => row.AdoId == adoId && row.Vault == vault, cancellation);

        return isInVault ? null : Problem.NotFound($"PBI-{adoId} isn't in {vault}.");
    }

    private async Task<Problem?> OpenTaskProblemAsync(NewTask task, CancellationToken cancellation)
    {
        var type = TypeOf(task)!;

        if (task.PbiId is null || !type.OnePerPbi)
            return null;

        var open = await AgentTasks.OpenTaskIdAsync(db, type.Kind, task.PbiId.Value, cancellation);

        return open is null ? null : Problem.Conflict($"{open} is still open on PBI-{task.PbiId}.");
    }

    // PBI tasks are numbered per PBI like the pipeline's; a type that needs a PBI always has one here.
    private Task<string> NextIdAsync(NewTask task, UserTaskType type, CancellationToken cancellation)
    {
        if (task.PbiId is null)
            return ItemIds.NextGlobalAsync(db, type.NoPbiPrefix!, cancellation);

        return ItemIds.NextAsync(db, AgentStages.StageOfKind(type.Kind)!.Prefix, task.PbiId.Value, cancellation);
    }

    // A schedule's task carries the schedule, so its next tick sees it still waiting.
    private static string DataOf(NewTask task, UserTaskType type)
    {
        var data = type.Kind == ItemKind.Docs ? DocsData(task) : AgentData(task);

        data["createdBy"] = CreatedBy;
        data["doneWhen"] = task.AcceptanceCriteria.Trim();

        if (task.ScheduleId is not null)
        {
            data["scheduleId"] = task.ScheduleId;
            data["key"] = ScheduleKeys.Of(task.ScheduleId.Value);
        }

        return JsonSerializer.Serialize(data, Json);
    }

    private static Dictionary<string, object?> AgentData(NewTask task)
    {
        return new() { ["goal"] = task.AcceptanceCriteria.Trim(), ["repos"] = task.PbiId is null ? task.Repos : Array.Empty<string>() };
    }

    // The tech-writer's request task (user decision 2026-10-15): no note is named; the tech-writer finds the notes the
    // description is about, then updates or creates them as the vault's rules say.
    private static Dictionary<string, object?> DocsData(NewTask task)
    {
        return new() { ["key"] = $"request:{task.Vault}:user:{DateTime.UtcNow:O}", ["mode"] = "request", ["vault"] = task.Vault };
    }
}
