namespace PowerLoom.Features.Tasks.Schedules.Models;

public sealed record SavedSchedule(int Id, string Name, string AgentId, string Vault, string Cron, bool Enabled, string? TaskType);
