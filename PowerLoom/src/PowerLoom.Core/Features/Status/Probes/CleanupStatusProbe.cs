using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.Cleanup;
using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Status.Probes;

// Each vault's artefact cleanup: its mode (dry run or deleting) and the last report.
public sealed class CleanupStatusProbe(PowerLoomDbContext db, CleanupSettingsStore store)
{
    public async Task<List<CleanupStatus>> ReadAsync(CancellationToken cancellation)
    {
        var vaults = await db.Vaults.AsNoTracking().Where(vault => vault.RemovedAt == null).OrderBy(vault => vault.Name).Select(vault => vault.Name).ToListAsync(cancellation);
        var statuses = new List<CleanupStatus>();

        foreach (var vault in vaults)
            statuses.Add(await StatusOfAsync(vault, cancellation));

        return statuses;
    }

    private async Task<CleanupStatus> StatusOfAsync(string vault, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);

        return new CleanupStatus(vault, settings.DryRun, await store.ReadReportAsync(vault, cancellation));
    }
}
