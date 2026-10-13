using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.LocalStackIntegration.Settings;

// The vault's Local stack settings in PowerLoom's `config` table, under the key the TypeScript side (the agent-runner) reads.
public sealed class LocalStackSettingsStore(PowerLoomDbContext db)
{
    private const string LocalStackKey = "localStack";

    public async Task<LocalStackSettings> ReadAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<LocalStackSettings>(db, vault, LocalStackKey, cancellation) ?? new LocalStackSettings();

    public Task SaveAsync(string vault, LocalStackSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, LocalStackKey, settings, cancellation);
}
