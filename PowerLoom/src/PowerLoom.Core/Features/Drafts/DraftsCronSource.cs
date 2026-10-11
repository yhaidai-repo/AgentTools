using Microsoft.EntityFrameworkCore;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Drafts;

// One scan per vault, every 10 minutes (the worker's drafts job; user decision 2026-10-02).
public sealed class DraftsCronSource(IServiceScopeFactory scopes) : ICronSource
{
    private const string Cron = "*/10 * * * *";

    public async Task<IReadOnlyList<CronEntry>> EntriesAsync(CancellationToken cancellation)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var vaults = await db.Vaults.AsNoTracking().Where(vault => vault.RemovedAt == null).OrderBy(vault => vault.Name).Select(vault => vault.Name).ToListAsync(cancellation);

        return vaults.Select(vault => new CronEntry($"drafts:{vault}", Cron, new ScanVaultDrafts(vault))).ToList();
    }
}
