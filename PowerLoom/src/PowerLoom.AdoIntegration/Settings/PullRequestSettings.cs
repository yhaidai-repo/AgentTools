namespace PowerLoom.AdoIntegration.Settings;

public sealed class PullRequestSettings
{
    // How often the user's active PRs are listed.
    public string Cron { get; set; } = "*/15 * * * *";

    // PRs whose details (pushes, linked work items) are fetched per run; the rest wait for the next run.
    public int MaxPullRequestsPerRun { get; set; } = 50;

    // Repo names (catalog) whose PRs are listed; empty = every repo (user decision 2026-10-02).
    public List<string> Repos { get; set; } = [];
}
