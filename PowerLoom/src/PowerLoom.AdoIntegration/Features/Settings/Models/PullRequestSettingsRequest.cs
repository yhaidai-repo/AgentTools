namespace PowerLoom.AdoIntegration.Features.Settings.Models;

public sealed record PullRequestSettingsRequest(bool Enabled, string Cron, int MaxPullRequestsPerRun, List<string>? Repos);
