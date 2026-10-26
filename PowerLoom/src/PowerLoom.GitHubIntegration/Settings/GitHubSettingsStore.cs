using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.GitHubIntegration.Settings;

// The vault's GitHub settings in PowerLoom's `config` table, under the key the TypeScript side (the agent-runner) reads.
public sealed class GitHubSettingsStore(PowerLoomDbContext db)
{
    private const string StoredKey = "github";
    private const string StatusKey = "githubStatus";

    public async Task<GitHubSettings> ReadAsync(string vault, CancellationToken cancellation) => await VaultSettings.ReadAsync<GitHubSettings>(db, vault, StoredKey, cancellation) ?? new GitHubSettings();

    public Task SaveAsync(string vault, GitHubSettings settings, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, StoredKey, settings, cancellation);

    // Kept apart from the settings, so a check finishing never overwrites a save from the page.
    public Task SaveStatusAsync(string vault, GitHubCheckStatus status, CancellationToken cancellation) => VaultSettings.SaveAsync(db, vault, StatusKey, status, cancellation);
}
