namespace PowerLoom.Features.Tasks.Schedules.Models;

// A schedule as the Tasks page saves it; `Id` null = a new one. `Goal` and `Repos` apply to an agent without a
// producer (the vault review takes no params). With `TaskType` (user decision 2026-10-14) the schedule creates a task of
// that type for any agent that takes it: `Name` is the task's title, `AgentId` is ignored, and the rest is the task as
// the task form sends it.
public sealed record ScheduleInput(int? Id, string Name, string AgentId, string Vault, string Cron, bool Enabled, string? Goal, List<string>? Repos, string? TaskType = null, string? Description = null, string? AcceptanceCriteria = null, string? Pbi = null, string? DocPath = null);
