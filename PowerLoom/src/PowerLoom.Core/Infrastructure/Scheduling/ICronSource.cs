namespace PowerLoom.Infrastructure.Scheduling;

// A feature's cron lines, read fresh on every tick (vault settings, agent configs, task schedules): no second schedule
// store to keep in step, saving a setting is enough.
public interface ICronSource
{
    Task<IReadOnlyList<CronEntry>> EntriesAsync(CancellationToken cancellation);
}
