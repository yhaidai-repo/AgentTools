namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// Only PBIs nobody has started yet enter adoa by themselves (user decision 2026-10-02): imports refuse the others; the
// Backlog's "Sync PBI" is free of it. A PBI already in adoa stays and keeps being refreshed in any state.
public static class EntryRule
{
    private static readonly string[] EntryStates = ["New", "Ready for Dev"];

    public static bool CanEnter(string adoState) => EntryStates.Contains(adoState);

    public static string Refusal(int adoId, string adoState) => $"PBI-{adoId} is {adoState} in Azure DevOps; only {string.Join(" or ", EntryStates)} PBIs enter adoa";
}
