using PowerLoom.GitHubIntegration.Client;
using PowerLoom.GitHubIntegration.Settings;

namespace PowerLoom.GitHubIntegration.Features.SyncPullRequests;

public static class SyncGitHubPullRequestsHandler
{
    public static async Task Handle(SyncGitHubPullRequests message, GitHubSettingsStore settings, IGitHubClientFactory clients, GitHubPullRequestSync sync, ILogger<SyncGitHubPullRequests> logger, CancellationToken cancellation)
    {
        var github = await settings.ReadAsync(message.Vault, cancellation);

        if (!github.IsActive)
        {
            logger.LogInformation("github pull requests {Vault}: GitHub is off or has no token", message.Vault);

            return;
        }

        var status = await CheckAsync(message.Vault, github, clients, sync, cancellation);

        await settings.SaveStatusAsync(message.Vault, status, cancellation);
        logger.LogInformation("github pull requests {Vault}: {Summary}", message.Vault, status.Error ?? status.Summary);
    }

    // GitHub refusing (a token without Pull requests: read, an expired one) is the check's outcome, shown on Settings → Sync.
    private static async Task<GitHubCheckStatus> CheckAsync(string vault, GitHubSettings github, IGitHubClientFactory clients, GitHubPullRequestSync sync, CancellationToken cancellation)
    {
        try
        {
            return new GitHubCheckStatus { CheckedAt = DateTime.UtcNow, Summary = await sync.RunAsync(vault, github, clients.For(github.Token), cancellation) };
        }
        catch (GitHubRequestException error)
        {
            return new GitHubCheckStatus { CheckedAt = DateTime.UtcNow, Error = error.Message };
        }
    }
}
