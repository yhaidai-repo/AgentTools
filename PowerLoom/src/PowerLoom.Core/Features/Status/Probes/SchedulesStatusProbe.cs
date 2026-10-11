using PowerLoom.Features.Status.Models;
using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Features.Status.Probes;

// Every cron line the ticker would run, with its next minute.
public sealed class SchedulesStatusProbe(IEnumerable<ICronSource> sources)
{
    public async Task<List<ScheduleStatus>> ReadAsync(DateTimeOffset now, CancellationToken cancellation)
    {
        var entries = new List<ScheduleStatus>();

        foreach (var source in sources)
            entries.AddRange(await EntriesOfAsync(source, now, cancellation));

        return entries.OrderBy(entry => entry.NextDueAt ?? DateTimeOffset.MaxValue).ThenBy(entry => entry.Key).ToList();
    }

    // A failing source (a table missing) shows as no entries, as in the ticker.
    private static async Task<IEnumerable<ScheduleStatus>> EntriesOfAsync(ICronSource source, DateTimeOffset now, CancellationToken cancellation)
    {
        try
        {
            var entries = await source.EntriesAsync(cancellation);

            return entries.Select(entry => new ScheduleStatus(entry.Key, entry.Cron, entry.Message.GetType().Name, CronDue.NextAfter(entry.Cron, now)));
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            return [];
        }
    }
}
