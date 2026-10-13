using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.DevHubIntegration.Settings;

// The vault's DevHub settings in PowerLoom's `config` table, under the key the TypeScript side (the agent-runner) reads.
public sealed class DevHubSettingsStore(PowerLoomDbContext db)
{
    // "localStack": the stored key from before the rename to DevHub (2026-10-14): saved settings keep working.
    private const string StoredKey = "localStack";

    public async Task<DevHubSettings> ReadAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<DevHubSettings>(db, vault, StoredKey, cancellation) ?? new DevHubSettings();

    public Task SaveAsync(string vault, DevHubSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, StoredKey, settings, cancellation);
}
