using PowerLoom.Features.Cleanup.Models;

namespace PowerLoom.Features.Status.Models;

// Everything the dashboard's Application tab shows about the running system, from PowerLoom's own data.
public sealed record SystemStatus(
    DateTimeOffset CheckedAt,
    ComponentState Database,
    TickerStatus Ticker,
    RunnerStatus Runner,
    bool ConfluenceConfigured,
    List<VaultStatus> Vaults,
    MessagingStatus Messaging,
    List<RunInProgress> Runs,
    List<ScheduleStatus> Schedules,
    List<SyncRun> RecentSyncs,
    BudgetStatus Budget,
    List<OutsideComponentState> Outside,
    List<CleanupStatus> Cleanups,
    List<Attention> Attention);
