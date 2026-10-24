namespace PowerLoom.Features.Tasks.Schedules;

// The key of a task a schedule created: the schedule and the tick's time, so every tick's task is told apart.
public static class ScheduleKeys
{
    public static string Of(int scheduleId) => $"schedule:{scheduleId}:{DateTime.UtcNow:O}";
}
