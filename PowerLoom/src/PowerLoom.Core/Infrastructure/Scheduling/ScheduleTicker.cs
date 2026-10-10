using Wolverine;

namespace PowerLoom.Infrastructure.Scheduling;

// The one scheduler: every minute, every source's due cron lines publish their message. Wolverine delivers; no cron
// lives in Wolverine, so the cron rows in the database are the only schedule.
public sealed class ScheduleTicker(IEnumerable<ICronSource> sources, IServiceScopeFactory scopes, ILogger<ScheduleTicker> logger) : BackgroundService
{
    // For the health check: a ticker silent for minutes means the schedules are not running.
    public DateTimeOffset? LastTickAt { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        StartedAt = DateTimeOffset.UtcNow;

        while (!stoppingToken.IsCancellationRequested)
        {
            var minute = await WaitForNextMinuteAsync(stoppingToken);

            await TickAsync(minute, stoppingToken);
        }
    }

    public async Task TickAsync(DateTimeOffset minute, CancellationToken cancellation)
    {
        using var scope = scopes.CreateScope();
        var bus = scope.ServiceProvider.GetRequiredService<IMessageBus>();

        foreach (var source in sources)
            await PublishDueAsync(source, minute, bus, cancellation);

        LastTickAt = minute;
    }

    private async Task PublishDueAsync(ICronSource source, DateTimeOffset minute, IMessageBus bus, CancellationToken cancellation)
    {
        var entries = await EntriesOrNoneAsync(source, cancellation);

        WarnAboutInvalidCrons(entries);

        foreach (var entry in entries.Where(entry => CronDue.IsDue(entry.Cron, minute)))
        {
            logger.LogInformation("schedule {Key}: {Message}", entry.Key, entry.Message.GetType().Name);
            await bus.PublishAsync(entry.Message);
        }
    }

    // A source that fails (a table missing, a bad row) must not stop the other sources' schedules.
    private async Task<IReadOnlyList<CronEntry>> EntriesOrNoneAsync(ICronSource source, CancellationToken cancellation)
    {
        try
        {
            return await source.EntriesAsync(cancellation);
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            logger.LogError(error, "schedule source {Source} failed; its schedules skip this minute", source.GetType().Name);

            return [];
        }
    }

    private void WarnAboutInvalidCrons(IReadOnlyList<CronEntry> entries)
    {
        foreach (var entry in entries.Where(entry => !CronDue.IsValid(entry.Cron)))
            logger.LogWarning("schedule {Key}: invalid cron \"{Cron}\", never due", entry.Key, entry.Cron);
    }

    private static async Task<DateTimeOffset> WaitForNextMinuteAsync(CancellationToken cancellation)
    {
        var next = CronDue.MinuteOf(DateTimeOffset.UtcNow).AddMinutes(1);

        await Task.Delay(next - DateTimeOffset.UtcNow, cancellation);

        return next;
    }
}
