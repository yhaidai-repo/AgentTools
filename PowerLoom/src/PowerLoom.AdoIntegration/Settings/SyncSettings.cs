namespace PowerLoom.AdoIntegration.Settings;

public sealed class SyncSettings
{
    public string Cron { get; set; } = "*/30 * * * *";

    // Work item details fetched per run; the rest wait for the next run (the cursor is the last id handled).
    public int MaxItemsPerRun { get; set; } = 400;

    // "current" (follows ADO) or an iteration path.
    public string Sprint { get; set; } = "current";
}
