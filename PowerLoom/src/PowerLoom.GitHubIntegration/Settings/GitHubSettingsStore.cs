using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.GitHubIntegration.Settings;

// The vault's GitHub settings in PowerLoom's `config` table, under the key the TypeScript side (the agent-runner) reads.
public sealed class GitHubSettingsStore(PowerLoomDbContext db)
{
    private const string StoredKey = "github";

    public async Task<GitHubSettings> ReadAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<GitHubSettings>(db, vault, StoredKey, cancellation) ?? new GitHubSettings();

    public Task SaveAsync(string vault, GitHubSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, StoredKey, settings, cancellation);
}
