namespace PowerLoom.GitHubIntegration.Settings;

// A vault's GitHub (user decision 2026-10-25): a personal access token that reads its repos (and pull requests), the
// owner whose repos the catalog lists, and the token's user, whose pull requests come to Reviews.
public sealed class GitHubSettings
{
    public const string DefaultPullRequestsCron = "*/30 * * * *";

    public bool Enabled { get; set; }

    // A fine-grained token (Contents and Pull requests: read); stored in the database, never shown again.
    public string Token { get; set; } = "";

    // A user or organization; empty: every repo the token can read.
    public string Owner { get; set; } = "";

    // The token's user as GitHub answered when the settings were saved.
    public string Login { get; set; } = "";

    // The pull request check (user decision 2026-10-25: like Azure DevOps'); on as soon as GitHub is connected.
    public bool PullRequestsEnabled { get; set; } = true;

    public string PullRequestsCron { get; set; } = DefaultPullRequestsCron;

    // The repos the check covers, as owner/name, like Azure DevOps' repo chips; none chosen: every enabled GitHub repo.
    public List<string> PullRequestsRepos { get; set; } = [];

    public bool ChecksPullRequestsOf(string owner, string name)
    {
        return PullRequestsRepos.Count == 0 || PullRequestsRepos.Contains($"{owner}/{name}", StringComparer.OrdinalIgnoreCase);
    }

    public bool IsActive => Enabled && Token.Length > 0 && Login.Length > 0;
}
