using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;

namespace PowerLoom.Domain.Pbis;

// The drafts the agents captured into a vault (vault_capture): written until the tech-writer, or the user, merged them.
public static class VaultCaptures
{
    public const string Merged = "merged";

    private static readonly string[] Written = ["created", "appended"];

    public static async Task<List<string>> WrittenNamesAsync(PowerLoomDbContext db, string vault, CancellationToken cancellation)
    {
        return await db.VaultCaptures.AsNoTracking()
            .Where(capture => Written.Contains(capture.Status) && capture.Pbi.Vault == vault)
            .Select(capture => capture.Name).Distinct().ToListAsync(cancellation);
    }

    // A written capture whose draft left the draft folder was merged (by the tech-writer or by hand).
    public static Task<int> MarkMergedAsync(PowerLoomDbContext db, string vault, IReadOnlyDictionary<string, bool> stillDrafts, CancellationToken cancellation)
    {
        var merged = stillDrafts.Where(entry => !entry.Value).Select(entry => entry.Key).ToList();

        return db.VaultCaptures.Where(capture => Written.Contains(capture.Status) && capture.Pbi.Vault == vault && merged.Contains(capture.Name))
            .ExecuteUpdateAsync(set => set.SetProperty(capture => capture.Status, Merged), cancellation);
    }
}
