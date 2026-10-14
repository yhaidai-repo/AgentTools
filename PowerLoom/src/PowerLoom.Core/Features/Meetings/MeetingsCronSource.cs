using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.ImportSources;
using PowerLoom.Features.Meetings.Models;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;

namespace PowerLoom.Features.Meetings;

// The meetings inbox is read on the vault's import schedule, for the vaults whose import is on (the same switch and
// cron as the mail import; user decision 2026-10-14). Needs no Azure DevOps.
public sealed class MeetingsCronSource(IServiceScopeFactory scopes) : ICronSource
{
    public async Task<IReadOnlyList<CronEntry>> EntriesAsync(CancellationToken cancellation)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var imports = scope.ServiceProvider.GetRequiredService<ImportSettingsStore>();
        var vaults = await db.Vaults.AsNoTracking().Select(vault => vault.Name).ToListAsync(cancellation);
        var entries = new List<CronEntry>();

        foreach (var vault in vaults)
        {
            if (await VaultFeatures.IsOnAsync(db, vault, VaultFeatures.MailSync, cancellation))
                entries.Add(new CronEntry($"meetings:{vault}", (await imports.ReadAsync(vault, cancellation)).Cron, new ImportMeetings(vault)));
        }

        return entries;
    }
}
