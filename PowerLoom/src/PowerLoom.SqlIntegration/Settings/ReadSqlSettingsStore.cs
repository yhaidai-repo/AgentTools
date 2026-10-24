using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.SqlIntegration.Settings;

// The vault's Read SQL settings in PowerLoom's `config` table, under the key the TypeScript side (the agent-runner) reads.
public sealed class ReadSqlSettingsStore(PowerLoomDbContext db)
{
    private const string ReadSqlKey = "readSql";

    public async Task<ReadSqlSettings> ReadAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<ReadSqlSettings>(db, vault, ReadSqlKey, cancellation) ?? new ReadSqlSettings();

    public Task SaveAsync(string vault, ReadSqlSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, ReadSqlKey, settings, cancellation);
}
