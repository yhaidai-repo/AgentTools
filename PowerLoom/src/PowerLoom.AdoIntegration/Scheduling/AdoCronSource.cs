using Microsoft.EntityFrameworkCore;
using PowerLoom.AdoIntegration.Features.SyncPbis;
using PowerLoom.AdoIntegration.Features.SyncPullRequests;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Features.ImportSources;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;

namespace PowerLoom.AdoIntegration.Scheduling;

// The per-vault ADO schedules as the vaults' features say (user decision 2026-10-05): the PBI sync, the import and the
// pull request check, each with the cron from its settings, for the vaults whose integration is on.
public sealed class AdoCronSource(IServiceScopeFactory scopes) : ICronSource
{
    public async Task<IReadOnlyList<CronEntry>> EntriesAsync(CancellationToken cancellation)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var settings = scope.ServiceProvider.GetRequiredService<AdoSettingsStore>();
        var imports = scope.ServiceProvider.GetRequiredService<ImportSettingsStore>();
        var vaults = await db.Vaults.AsNoTracking().Select(vault => vault.Name).ToListAsync(cancellation);
        var entries = new List<CronEntry>();

        foreach (var vault in vaults)
            entries.AddRange(await EntriesOfAsync(vault, db, settings, imports, cancellation));

        return entries;
    }

    private static async Task<IReadOnlyList<CronEntry>> EntriesOfAsync(string vault, PowerLoomDbContext db, AdoSettingsStore settings, ImportSettingsStore imports, CancellationToken cancellation)
    {
        var ado = await settings.ReadAdoAsync(vault, cancellation);

        if (ado is null || !ado.IsActive)
            return [];

        var entries = new List<CronEntry>();

        if (await VaultFeatures.IsOnAsync(db, vault, VaultFeatures.AdoSync, cancellation))
            entries.Add(new CronEntry($"sync:{vault}", (await settings.ReadSyncAsync(vault, cancellation)).Cron, new SyncPbis(vault, null)));

        if (await VaultFeatures.IsOnAsync(db, vault, VaultFeatures.MailSync, cancellation))
            entries.Add(new CronEntry($"import:{vault}", (await imports.ReadAsync(vault, cancellation)).Cron, new SyncPbis(vault, null, SyncSources.Imports)));

        if (await VaultFeatures.IsOnAsync(db, vault, VaultFeatures.PullRequests, cancellation))
            entries.Add(new CronEntry($"pull-requests:{vault}", (await settings.ReadPullRequestsAsync(vault, cancellation)).Cron, new SyncPullRequests(vault)));

        return entries;
    }
}
