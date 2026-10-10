namespace PowerLoom.Features.Tasks.Schedules.Models;

// A schedule as the Tasks page saves it; `Id` null = a new one. `Goal` and `Repos` apply to an agent without a
// producer (the vault review takes no params).
public sealed record ScheduleInput(int? Id, string Name, string AgentId, string Vault, string Cron, bool Enabled, string? Goal, List<string>? Repos);
