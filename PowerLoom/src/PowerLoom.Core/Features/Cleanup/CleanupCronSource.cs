using Microsoft.EntityFrameworkCore;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Cleanup;

// One cleanup per vault, daily at 03:00 UTC, when no agent is at work on the PC.
public sealed class CleanupCronSource(IServiceScopeFactory scopes) : ICronSource
{
    public const string Cron = "0 3 * * *";

    public async Task<IReadOnlyList<CronEntry>> EntriesAsync(CancellationToken cancellation)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var vaults = await db.Vaults.AsNoTracking().Where(vault => vault.RemovedAt == null).OrderBy(vault => vault.Name).Select(vault => vault.Name).ToListAsync(cancellation);

        return vaults.Select(vault => new CronEntry($"cleanup:{vault}", Cron, new CleanUpArtefacts(vault))).ToList();
    }
}
