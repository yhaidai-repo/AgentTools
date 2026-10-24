using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Api.Tests.Probes;

// Two lines: one due every minute, one only at half past.
public sealed class ProbeCronSource : ICronSource
{
    public const string EveryMinute = "every-minute";
    public const string HalfPast = "half-past";

    public Task<IReadOnlyList<CronEntry>> EntriesAsync(CancellationToken cancellation)
    {
        IReadOnlyList<CronEntry> entries =
        [
            new CronEntry(EveryMinute, "* * * * *", new VaultProbe(PowerLoomHost.Vault, EveryMinute)),
            new CronEntry(HalfPast, "30 * * * *", new VaultProbe(PowerLoomHost.Vault, HalfPast)),
        ];

        return Task.FromResult(entries);
    }
}
