namespace PowerLoom.Features.Status.Models;

public sealed record ScheduleStatus(string Key, string Cron, string Message, DateTimeOffset? NextDueAt);
