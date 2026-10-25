using System.Threading.Channels;
using PowerLoom.Infrastructure.ErrorLog.Models;

namespace PowerLoom.Infrastructure.ErrorLog;

// Saves the queued warnings and errors one by one and purges the table once a day. A write that fails is dropped: the
// error log is best effort, and logging its own failure would only queue another entry.
public sealed class ErrorLogWriter(Channel<PendingLogEntry> queue, ErrorLogStore store, TimeProvider clock) : BackgroundService
{
    private static readonly TimeSpan PurgeEvery = TimeSpan.FromDays(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var nextPurge = DateTimeOffset.MinValue;

        await foreach (var entry in ReadAllAsync(stoppingToken))
        {
            nextPurge = await PurgeWhenDueAsync(nextPurge, stoppingToken);
            await TryAsync(() => store.RecordAsync(entry, stoppingToken));
        }
    }

    // Wakes at least hourly with no entry, so the daily purge runs on a quiet day too.
    private async IAsyncEnumerable<PendingLogEntry> ReadAllAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var wait = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);

            wait.CancelAfter(TimeSpan.FromHours(1));

            var entry = await NextOrNullAsync(wait.Token, stoppingToken);

            if (entry is not null)
                yield return entry;
        }
    }

    private async Task<PendingLogEntry?> NextOrNullAsync(CancellationToken wait, CancellationToken stoppingToken)
    {
        try
        {
            return await queue.Reader.ReadAsync(wait);
        }
        catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
        {
            return null;
        }
    }

    private async Task<DateTimeOffset> PurgeWhenDueAsync(DateTimeOffset nextPurge, CancellationToken stoppingToken)
    {
        var now = clock.GetUtcNow();

        if (now < nextPurge)
            return nextPurge;

        await TryAsync(() => store.PurgeAsync(now.UtcDateTime, stoppingToken));

        return now + PurgeEvery;
    }

    private static async Task TryAsync(Func<Task> write)
    {
        try
        {
            await write();
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            // Dropped on purpose (see the class comment).
        }
    }
}
