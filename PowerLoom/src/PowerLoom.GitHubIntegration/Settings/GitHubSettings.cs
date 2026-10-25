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

    public string PullRequestsCron { get; set; } = DefaultPullRequestsCron;

    public bool IsActive => Enabled && Token.Length > 0 && Login.Length > 0;
}
