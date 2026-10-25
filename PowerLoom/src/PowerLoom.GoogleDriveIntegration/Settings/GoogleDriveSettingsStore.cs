using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.GoogleDriveIntegration.Settings;

// The vault's Google Drive settings in PowerLoom's `config` table, under the key the TypeScript side (the agent-runner)
// reads.
public sealed class GoogleDriveSettingsStore(PowerLoomDbContext db)
{
    private const string StoredKey = "googleDrive";

    public async Task<GoogleDriveSettings> ReadAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<GoogleDriveSettings>(db, vault, StoredKey, cancellation) ?? new GoogleDriveSettings();

    public Task SaveAsync(string vault, GoogleDriveSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, StoredKey, settings, cancellation);
}
