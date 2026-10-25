using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PowerLoom.Infrastructure.ErrorLog;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Api.Tests.ErrorLog;

[Collection(PowerLoomCollection.Name)]
public sealed class ErrorLogTests(PowerLoomHost host)
{
    private static readonly TimeSpan Wait = TimeSpan.FromSeconds(10);

    [Fact]
    public async Task A_backend_warning_lands_in_the_error_log_and_a_repeat_adds_to_its_count()
    {
        var logger = host.Host.Services.GetRequiredService<ILoggerFactory>().CreateLogger("PowerLoom.Tests.ErrorLog");
        var marker = $"error-log probe {Guid.NewGuid():N}";

        logger.LogWarning("{Marker}: retry in {Seconds} s", marker, 30);
        logger.LogWarning("{Marker}: retry in {Seconds} s", marker, 60);
        logger.LogInformation("{Marker}: an information line stays out", marker);

        var entry = await WaitForAsync(marker, count: 2);

        Assert.Equal(("backend", "warn", 2), (entry.Service, entry.Level, entry.Count));
        Assert.Equal($"PowerLoom.Tests.ErrorLog: {marker}: retry in 60 s", entry.Message);
    }

    [Fact]
    public async Task The_purge_drops_rows_not_seen_for_14_days()
    {
        var now = DateTime.UtcNow;

        await SeedAsync(now, ("purge-old", 20), ("purge-recent", 1));
        await host.Host.Services.GetRequiredService<ErrorLogStore>().PurgeAsync(now, CancellationToken.None);

        Assert.Equal(["purge-recent"], await Db().LogEntries.Where(row => row.Fingerprint.StartsWith("purge-")).Select(row => row.Fingerprint).ToListAsync());
    }

    private async Task<LogEntry> WaitForAsync(string marker, int count)
    {
        var deadline = DateTime.UtcNow + Wait;
        LogEntry? entry = null;

        while (DateTime.UtcNow < deadline && entry?.Count != count)
        {
            await Task.Delay(100);
            entry = await Db().LogEntries.AsNoTracking().SingleOrDefaultAsync(row => row.Message.Contains(marker));
        }

        return entry ?? throw new TimeoutException($"no log entry for {marker}");
    }

    private async Task SeedAsync(DateTime now, params (string Fingerprint, int DaysAgo)[] rows)
    {
        var db = Db();

        db.LogEntries.AddRange(rows.Select(row => new LogEntry { Service = "test", Level = "error", Message = row.Fingerprint, Fingerprint = row.Fingerprint, Count = 1, FirstAt = now.AddDays(-row.DaysAgo), LastAt = now.AddDays(-row.DaysAgo) }));
        await db.SaveChangesAsync();
    }

    private PowerLoomDbContext Db() => host.Host.Services.CreateScope().ServiceProvider.GetRequiredService<PowerLoomDbContext>();
}
