using DevSecrets.DevHub.Models;

namespace DevSecrets.DevHub;

// Stops a stack when its time is up, and when DevHub shuts down: nobody would stop it otherwise.
public sealed class StackExpiryService(
    StackOperationTracker tracker,
    StackService stacks,
    TimeProvider time,
    ILogger<StackExpiryService> logger
) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(30);

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);

        if (!tracker.HasOperation())
            return;

        logger.LogInformation("DevHub is stopping: stopping the local stack");
        await stacks.StopAsync(CancellationToken.None);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(CheckInterval, time);

        while (await timer.WaitForNextTickAsync(stoppingToken))
            await StopWhenExpiredAsync(stoppingToken);
    }

    private async Task StopWhenExpiredAsync(CancellationToken cancellationToken)
    {
        if (!tracker.IsExpired(time.GetUtcNow()))
            return;

        logger.LogInformation("Stack time is up: stopping it");

        try
        {
            await stacks.StopAsync(cancellationToken);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "Stopping the expired stack failed");
        }
    }
}
