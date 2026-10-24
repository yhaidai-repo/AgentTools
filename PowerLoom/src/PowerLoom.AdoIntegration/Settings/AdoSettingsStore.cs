using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.AdoIntegration.Settings;

// The vault's ADO settings in PowerLoom's `config` table, under the keys the TypeScript side uses.
public sealed class AdoSettingsStore(PowerLoomDbContext db)
{
    private const string AdoKey = "ado";
    private const string SyncKey = "sync";
    private const string PullRequestsKey = "pullRequests";

    // Null until the vault's integration was saved once.
    public Task<AdoSettings?> ReadAdoAsync(string vault, CancellationToken cancellation) => VaultSettings.ReadAsync<AdoSettings>(db, vault, AdoKey, cancellation);

    public Task SaveAdoAsync(string vault, AdoSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, AdoKey, settings, cancellation);

    public async Task<SyncSettings> ReadSyncAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<SyncSettings>(db, vault, SyncKey, cancellation) ?? new SyncSettings();

    public Task SaveSyncAsync(string vault, SyncSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, SyncKey, settings, cancellation);

    public async Task<PullRequestSettings> ReadPullRequestsAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<PullRequestSettings>(db, vault, PullRequestsKey, cancellation) ?? new PullRequestSettings();

    public Task SavePullRequestsAsync(string vault, PullRequestSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, PullRequestsKey, settings, cancellation);
}
