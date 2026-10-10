namespace PowerLoom.AdoIntegration.Features.SyncPbis.Models;

// The ids whose details this run fetches, and the cursor the next run starts after (0 when the cycle is complete).
public sealed record SyncWindow(IReadOnlyList<int> Ids, int NextCursor)
{
    // Details are fetched for at most `cap` ids per run; the rest continue in the next run.
    public static SyncWindow Select(IReadOnlyList<int> allIds, int cursor, int cap)
    {
        var remaining = allIds.Where(id => id > cursor).ToList();
        var ids = remaining.Take(cap).ToList();
        var isCycleComplete = remaining.Count <= cap;

        return new SyncWindow(ids, isCycleComplete || ids.Count == 0 ? 0 : ids[^1]);
    }
}
