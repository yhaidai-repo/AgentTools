namespace PowerLoom.Features.Cleanup.Models;

// The last cleanup of a vault, as the Status page shows it: per store what went (or would go) and how much.
public sealed record CleanupReport(DateTimeOffset RanAt, bool DryRun, List<CleanupStoreReport> Stores, List<string> Errors)
{
    public long Bytes => Stores.Sum(store => store.Bytes);

    public int Items => Stores.Sum(store => store.Items);
}
