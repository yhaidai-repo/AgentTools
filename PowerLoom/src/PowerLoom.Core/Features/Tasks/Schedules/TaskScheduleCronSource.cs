using Microsoft.EntityFrameworkCore;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Tasks.Schedules;

// Every enabled task schedule, read fresh on every tick; a disabled one only creates tasks on "Create now".
public sealed class TaskScheduleCronSource(IServiceScopeFactory scopes) : ICronSource
{
    public async Task<IReadOnlyList<CronEntry>> EntriesAsync(CancellationToken cancellation)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var schedules = await db.TaskSchedules.AsNoTracking().Where(schedule => schedule.Enabled && db.Vaults.Any(vault => vault.Name == schedule.Vault && vault.RemovedAt == null)).Select(schedule => new { schedule.Id, schedule.Cron }).ToListAsync(cancellation);

        return schedules.Select(schedule => new CronEntry($"task-schedule:{schedule.Id}", schedule.Cron, new CreateScheduledTask(schedule.Id))).ToList();
    }
}
