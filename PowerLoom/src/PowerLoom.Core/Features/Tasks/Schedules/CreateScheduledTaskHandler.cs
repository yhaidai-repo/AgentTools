using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;

namespace PowerLoom.Features.Tasks.Schedules;

public static class CreateScheduledTaskHandler
{
    public static async Task Handle(CreateScheduledTask message, TaskScheduling scheduling, PowerLoomDbContext db, ILogger<CreateScheduledTask> logger, CancellationToken cancellation)
    {
        var schedule = await db.TaskSchedules.SingleOrDefaultAsync(row => row.Id == message.ScheduleId, cancellation);

        if (schedule is null || !schedule.Enabled || !await db.VaultExistsAsync(schedule.Vault, cancellation))
        {
            logger.LogInformation("task-schedule {ScheduleId}: the schedule or its vault is inactive", message.ScheduleId);

            return;
        }

        var result = await scheduling.TickAsync(schedule, cancellation);

        logger.LogInformation("task-schedule {ScheduleId} ({Name}): {Result}", schedule.Id, schedule.Name, result);
    }
}
