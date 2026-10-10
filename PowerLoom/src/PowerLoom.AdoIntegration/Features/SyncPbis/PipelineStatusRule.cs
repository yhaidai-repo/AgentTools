using PowerLoom.Persistence.Enums;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// Sync-owned transitions; agents own all the others.
public static class PipelineStatusRule
{
    private static readonly string[] ClosedAdoStates = ["Done", "Removed"];

    // A finished PBI stays done when its ADO content changes; only ADO Done/Removed moves it (user decision 2026-10-05).
    private static readonly PipelineStatus[] NeverStale = [PipelineStatus.New, PipelineStatus.Stale, PipelineStatus.Done];

    public static PipelineStatus Initial(string adoState) => IsClosed(adoState) ? PipelineStatus.Closed : PipelineStatus.New;

    public static PipelineStatus Next(PipelineStatus current, string adoState, bool contentChanged)
    {
        if (IsClosed(adoState))
            return PipelineStatus.Closed;

        if (current == PipelineStatus.Closed)
            return PipelineStatus.New;

        return contentChanged && !NeverStale.Contains(current) ? PipelineStatus.Stale : current;
    }

    private static bool IsClosed(string adoState) => ClosedAdoStates.Contains(adoState);
}
