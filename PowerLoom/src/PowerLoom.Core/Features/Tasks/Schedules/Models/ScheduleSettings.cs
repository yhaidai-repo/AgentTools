namespace PowerLoom.Features.Tasks.Schedules.Models;

// What a checked schedule input saves: who works on its tasks, of which type, and the params its tick reads.
public sealed record ScheduleSettings(string AgentId, string? TaskType, string Params);
