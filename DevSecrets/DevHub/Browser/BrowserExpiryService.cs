namespace DevSecrets.DevHub.Browser;

// Closes a browser case nobody touches any more, and the open one when DevHub shuts down, so its recording is written.
public sealed class BrowserExpiryService(BrowserService browsers, TimeProvider time, ILogger<BrowserExpiryService> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(30);

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        await browsers.DisposeAsync();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(CheckInterval, time);

        while (await timer.WaitForNextTickAsync(stoppingToken))
            await CloseWhenIdleAsync(stoppingToken);
    }

    private async Task CloseWhenIdleAsync(CancellationToken cancellationToken)
    {
        try
        {
            await browsers.CloseWhenIdleAsync(cancellationToken);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "Closing the idle browser case failed");
        }
    }
}
