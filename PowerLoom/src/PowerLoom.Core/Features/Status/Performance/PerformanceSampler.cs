using System.Diagnostics;

namespace PowerLoom.Features.Status.Performance;

public sealed class PerformanceSampler(PerformanceAccumulator accumulator, IServiceScopeFactory scopes, TimeProvider clock, ILogger<PerformanceSampler> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1), clock);
        do { await FlushAsync(stoppingToken); }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public async Task FlushAsync(CancellationToken cancellation)
    {
        try
        {
            using var process = Process.GetCurrentProcess();
            var samples = accumulator.Snapshot(process.WorkingSet64);
            using var scope = scopes.CreateScope();
            await scope.ServiceProvider.GetRequiredService<PerformanceStore>().SaveAsync(samples, clock.GetUtcNow().UtcDateTime, cancellation);
            accumulator.Acknowledge(samples);
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            logger.LogWarning(error, "Could not save application performance samples; their absolute totals will be retried");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        await FlushAsync(cancellationToken);
    }
}
