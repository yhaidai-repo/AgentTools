using PowerLoom.Features.ImportSources.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Features.ImportSources;

// The vault's import settings and the last run's status, in adoa's config table (keys `import`, `importStatus`).
public sealed class ImportSettingsStore(PowerLoomDbContext db)
{
    private const string SettingsKey = "import";
    private const string StatusKey = "importStatus";

    public async Task<ImportSettings> ReadAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<ImportSettings>(db, vault, SettingsKey, cancellation) ?? new ImportSettings();

    public Task SaveAsync(string vault, ImportSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, SettingsKey, settings, cancellation);

    public Task SaveStatusAsync(string vault, ImportRunStatus status, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, StatusKey, status, cancellation);
}
