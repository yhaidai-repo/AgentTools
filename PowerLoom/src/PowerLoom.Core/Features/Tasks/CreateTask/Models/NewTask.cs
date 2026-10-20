namespace PowerLoom.Features.Tasks.CreateTask.Models;

// A user task to create, from the Tasks page or a schedule's tick (`ScheduleId`); checked by TaskCreation.
public sealed record NewTask(string Vault, string Type, string Title, string Description, string AcceptanceCriteria, int? PbiId, IReadOnlyList<string> Repos, int? ScheduleId = null, IReadOnlyDictionary<string, object?>? Extra = null);
