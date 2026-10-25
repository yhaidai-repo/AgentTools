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

        logger.LogInformation("github pull requests {Vault}: {Summary}", message.Vault, await sync.RunAsync(message.Vault, github, clients.For(github.Token), cancellation));
    }
}
