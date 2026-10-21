using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PowerLoom.Features.Status.Models;
using PowerLoom.Features.Status.Probes;
using PowerLoom.Infrastructure.Health;
using PowerLoom.Infrastructure.Runner;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Status;

// One read of everything the Application tab shows, in the order the attention rules need it.
public sealed class SystemStatusReader(
    PowerLoomDbContext db,
    ScheduleTicker ticker,
    IRunnerClient runner,
    IOptions<RunnerOptions> runnerOptions,
    VaultStatusProbe vaults,
    MessagingStatusProbe messaging,
    RunsStatusProbe runs,
    SchedulesStatusProbe schedules,
    BudgetStatusProbe budget,
    OutsideAccessProbe outside,
    CleanupStatusProbe cleanups,
    TimeProvider clock)
{
    private const string ConfluenceStatusKey = "confluence";

    public async Task<SystemStatus> ReadAsync(CancellationToken cancellation)
    {
        var now = clock.GetUtcNow();
        var database = await DatabaseAsync(cancellation);
        var tickerStatus = Ticker(now);
        var runnerStatus = await RunnerAsync(cancellation);
        var messagingStatus = await messaging.ReadAsync(now, cancellation);
        var inProgress = await runs.InProgressAsync(now, cancellation);
        var syncs = await runs.RecentSyncsAsync(cancellation);
        var budgetStatus = await budget.ReadAsync(now, cancellation);
        var outsideReport = OutsideAccessRules.Evaluate(await outside.ReadAsync(now, cancellation));
        var attention = AttentionRules.Evaluate(database, tickerStatus, runnerStatus, messagingStatus, inProgress, syncs, budgetStatus).Concat(outsideReport.Attention).ToList();

        return new SystemStatus(now, database, tickerStatus, runnerStatus, await ConfluenceConfiguredAsync(cancellation), await vaults.ReadAsync(cancellation), messagingStatus, inProgress, await schedules.ReadAsync(now, cancellation), syncs, budgetStatus, outsideReport.States, await cleanups.ReadAsync(cancellation), attention);
    }

    private async Task<ComponentState> DatabaseAsync(CancellationToken cancellation)
    {
        var watch = Stopwatch.StartNew();

        try
        {
            await db.Database.ExecuteSqlRawAsync("select 1", cancellation);

            return new ComponentState(StateLevel.Ok, $"answers in {watch.ElapsedMilliseconds} ms");
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            return new ComponentState(StateLevel.Failed, error.Message);
        }
    }

    private TickerStatus Ticker(DateTimeOffset now)
    {
        var since = ticker.LastTickAt ?? ticker.StartedAt;
        var state = since is null ? StateLevel.Failed : now - since.Value <= ScheduleTickerHealthCheck.MaxSilence ? StateLevel.Ok : StateLevel.Degraded;

        return new TickerStatus(state, ticker.StartedAt, ticker.LastTickAt);
    }

    private async Task<RunnerStatus> RunnerAsync(CancellationToken cancellation)
    {
        var health = await runner.HealthAsync(cancellation);

        return new RunnerStatus(health.Reachable ? StateLevel.Ok : StateLevel.Degraded, health.Reachable, health.RunningTask, runnerOptions.Value.Url, health.Detail);
    }

    // The Confluence library writes {email} at start; no email = not configured.
    private async Task<bool> ConfluenceConfiguredAsync(CancellationToken cancellation)
    {
        var value = await db.Configs.AsNoTracking().Where(row => row.Key == ConfluenceStatusKey).Select(row => row.Value).SingleOrDefaultAsync(cancellation);

        if (value is null)
            return false;

        using var document = JsonDocument.Parse(value);

        return document.RootElement.TryGetProperty("email", out var email) && email.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(email.GetString());
    }
}
