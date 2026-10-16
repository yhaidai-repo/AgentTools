using PowerLoom.Persistence.Enums;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// Sync-owned transitions; agents own all the others.
public static class PipelineStatusRule
{
    private static readonly string[] ClosedAdoStates = ["Done", "Removed"];

    public static PipelineStatus Initial(string adoState) => IsClosed(adoState) ? PipelineStatus.Closed : PipelineStatus.New;

    // A changed title, description or AC keeps the status: the sync pulls the new text and the work goes on with it
    // (user decision 2026-10-16; it used to make the PBI stale). Only ADO Done/Removed closes it, and a closed one reopens.
    // A PBI the user closed in PowerLoom stays as it is until the user reopens it (user decision 2026-10-16).
    public static PipelineStatus Next(PipelineStatus current, string adoState, bool closedByUser)
    {
        if (closedByUser)
            return current;

        if (IsClosed(adoState))
            return PipelineStatus.Closed;

        return current == PipelineStatus.Closed ? PipelineStatus.New : current;
    }

    private static bool IsClosed(string adoState) => ClosedAdoStates.Contains(adoState);
}
