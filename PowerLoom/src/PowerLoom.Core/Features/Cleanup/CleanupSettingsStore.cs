using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Features.Cleanup;

// The vault's cleanup settings and its last report, in PowerLoom's config table (keys `cleanup`, `cleanupReport`).
public sealed class CleanupSettingsStore(PowerLoomDbContext db)
{
    public const string SettingsKey = "cleanup";
    public const string ReportKey = "cleanupReport";

    public async Task<CleanupSettings> ReadAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<CleanupSettings>(db, vault, SettingsKey, cancellation) ?? new CleanupSettings();

    public Task SaveAsync(string vault, CleanupSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, SettingsKey, settings, cancellation);

    public Task<CleanupReport?> ReadReportAsync(string vault, CancellationToken cancellation) => VaultSettings.ReadAsync<CleanupReport>(db, vault, ReportKey, cancellation);

    public Task SaveReportAsync(string vault, CleanupReport report, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, ReportKey, report, cancellation);
}
