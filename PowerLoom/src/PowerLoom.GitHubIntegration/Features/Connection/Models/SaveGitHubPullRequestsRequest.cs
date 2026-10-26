namespace PowerLoom.GitHubIntegration.Features.Connection.Models;

// Settings → Sync → GitHub pull requests: the check's switch and its cron.
public sealed record SaveGitHubPullRequestsRequest(bool Enabled, string Cron);
