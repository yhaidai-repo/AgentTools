using System.Text.Json;
using PowerLoom.Features.Tasks.CreateTask.Models;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Features.Tasks.Schedules;

// A schedule by task type (user decision 2026-10-14): the task each tick creates, as the task form described it; the
// schedule's name is the task's title and its task_type the type.
public sealed record TaskParams(string Description, string AcceptanceCriteria, int? PbiId, IReadOnlyList<string> Repos)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static TaskParams From(NewTask task) => new(task.Description.Trim(), task.AcceptanceCriteria.Trim(), task.PbiId, task.Repos);

    public static TaskParams Of(string paramsJson) => JsonSerializer.Deserialize<TaskParams>(paramsJson, Json)!;

    public string ToJson() => JsonSerializer.Serialize(this, Json);

    public NewTask ToTask(TaskSchedule schedule) => new(schedule.Vault, schedule.TaskType!, schedule.Name, Description, AcceptanceCriteria, PbiId, Repos ?? [], schedule.Id);
}
