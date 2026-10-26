namespace PowerLoom.Persistence.Settings;

// Settings → Sync → Pull requests: one check for Azure DevOps and GitHub (user decision 2026-10-26: the same feature, one
// card), switched on by the vault's `pullRequests` feature.
public sealed class PullRequestSettings
{
    public const string Key = "pullRequests";

    // How often the user's active PRs are listed.
    public string Cron { get; set; } = "*/15 * * * *";

    // Azure DevOps PRs whose details (pushes, linked work items) are fetched per run; the rest wait for the next run.
    public int MaxPullRequestsPerRun { get; set; } = 50;

    // The repos whose PRs are listed: Azure DevOps repo names and GitHub owner/name; empty = every repo (user decision
    // 2026-10-02).
    public List<string> Repos { get; set; } = [];

    public bool ChecksRepo(string name) => Repos.Count == 0 || Repos.Contains(name, StringComparer.OrdinalIgnoreCase);

    public static async Task<PullRequestSettings> ReadAsync(PowerLoomDbContext db, string vault, CancellationToken cancellation)
    {
        return await VaultSettings.ReadAsync<PullRequestSettings>(db, vault, Key, cancellation) ?? new PullRequestSettings();
    }
}
