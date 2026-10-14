using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.AzureIntegration.Settings;

// The vault's Read Azure settings in PowerLoom's `config` table, under the key the TypeScript side (the agent-runner) reads.
public sealed class ReadAzureSettingsStore(PowerLoomDbContext db)
{
    private const string ReadAzureKey = "readAzure";

    // Settings saved in the old shape are upgraded on first read and saved back at once (ReadAzureLegacy).
    public async Task<ReadAzureSettings> ReadAsync(string vault, CancellationToken cancellation)
    {
        var settings = await VaultSettings.ReadAsync<ReadAzureSettings>(db, vault, ReadAzureKey, cancellation) ?? new ReadAzureSettings();

        if (ReadAzureLegacy.Upgrade(settings))
            await SaveAsync(vault, settings, cancellation);

        return settings;
    }

    public Task SaveAsync(string vault, ReadAzureSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, ReadAzureKey, settings, cancellation);
}
