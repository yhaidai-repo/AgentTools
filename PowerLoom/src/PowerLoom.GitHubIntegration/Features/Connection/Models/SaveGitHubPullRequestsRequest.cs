namespace PowerLoom.GitHubIntegration.Features.Connection.Models;

// Settings → Sync → GitHub pull requests: the check's switch, its cron and the repos it covers (owner/name; none = all).
public sealed record SaveGitHubPullRequestsRequest(bool Enabled, string Cron, IReadOnlyList<string>? Repos = null);
