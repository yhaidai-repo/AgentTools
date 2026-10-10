using Microsoft.Extensions.Diagnostics.HealthChecks;
using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Infrastructure.Health;

// The schedules run only while the ticker ticks: a ticker silent for longer than this is a failure to alert on.
public sealed class ScheduleTickerHealthCheck(ScheduleTicker ticker, TimeProvider clock) : IHealthCheck
{
    private static readonly TimeSpan MaxSilence = TimeSpan.FromMinutes(5);

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var since = ticker.LastTickAt ?? ticker.StartedAt;

        if (since is null)
            return Task.FromResult(HealthCheckResult.Unhealthy("the schedule ticker hasn't started"));

        var silence = clock.GetUtcNow() - since.Value;
        var result = silence <= MaxSilence
            ? HealthCheckResult.Healthy($"last tick {ticker.LastTickAt:O}")
            : HealthCheckResult.Unhealthy($"no tick for {silence:g}");

        return Task.FromResult(result);
    }
}
