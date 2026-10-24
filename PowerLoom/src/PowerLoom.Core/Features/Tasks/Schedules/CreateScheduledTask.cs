namespace PowerLoom.Features.Tasks.Schedules;

// One tick of a task schedule (its cron): the schedule's task when one is needed.
public sealed record CreateScheduledTask(int ScheduleId);
