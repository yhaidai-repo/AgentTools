namespace PowerLoom.Features.Tasks.Schedules.Models;

// A schedule as the Tasks page saves it; `Id` null = a new one. It creates a task of `TaskType` for any agent that takes
// it (user decision 2026-10-14): `Name` is the task's title, and the rest is the task as the task form sends it.
public sealed record ScheduleInput(int? Id, string Name, string Vault, string Cron, bool Enabled, string TaskType, string? Description, string? AcceptanceCriteria, string? Pbi, List<string>? Repos);
