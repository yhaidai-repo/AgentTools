using PowerLoom.Contracts;
using PowerLoom.GitHubIntegration.Client;
using PowerLoom.GitHubIntegration.Features.Connection.Models;
using PowerLoom.GitHubIntegration.Settings;

namespace PowerLoom.GitHubIntegration.Features.Connection;

// Settings → Repositories → GitHub: the vault's switch, its token (written once, never read back) and the owner whose
// repos the catalog lists. Saving asks GitHub who the token is, so a bad token is refused at once.
public sealed class GitHubConnection(GitHubSettingsStore store, IGitHubClientFactory clients)
{
    private const string NoToken = "Enter a GitHub token: a fine-grained personal access token with Contents and Pull requests (read) on the repos.";

    public async Task<Outcome<GitHubSettings>> SaveAsync(string vault, SaveGitHubRequest request, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var token = TokenOrSaved(request.Token, settings);

        if (request.Enabled && token.Length == 0)
            return Outcome<GitHubSettings>.Failure(Problem.Invalid(NoToken));

        var login = token.Length == 0 ? Outcome<string>.Success("") : await LoginOfAsync(token, cancellation);

        if (!login.Ok)
            return Outcome<GitHubSettings>.Failure(login.Problem!);

        settings.Enabled = request.Enabled;
        settings.Token = token;
        settings.Owner = (request.Owner ?? "").Trim();
        settings.Login = login.Value!;
        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<GitHubSettings>.Success(settings);
    }

    public async Task<GitHubCheck> TestAsync(string vault, TestGitHubRequest request, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var token = TokenOrSaved(request.Token, settings);
        var owner = string.IsNullOrWhiteSpace(request.Owner) ? settings.Owner : request.Owner.Trim();

        return token.Length == 0 ? new GitHubCheck(false, NoToken) : await CheckAsync(clients.For(token), owner, cancellation);
    }

    public static GitHubSummary SummaryOf(GitHubSettings settings) => new(settings.Enabled, settings.Owner, settings.Login, settings.Token.Length > 0);

    /// <summary>The repos of the owner (all the token reads when the owner is empty).</summary>
    public static bool IsOwned(string repoOwner, string owner) => owner.Length == 0 || repoOwner.Equals(owner, StringComparison.OrdinalIgnoreCase);

    private static async Task<GitHubCheck> CheckAsync(IGitHubClient client, string owner, CancellationToken cancellation)
    {
        try
        {
            var login = await client.GetLoginAsync(cancellation);
            var repos = (await client.ListRepositoriesAsync(cancellation)).Count(repo => IsOwned(repo.Owner, owner));
            var whose = owner.Length == 0 ? "" : $" of {owner}";

            return new GitHubCheck(repos > 0, repos > 0 ? $"Signed in as {login}: {repos} repos{whose}." : $"Signed in as {login}, but the token reads no repos{whose}.");
        }
        catch (GitHubRequestException error)
        {
            return new GitHubCheck(false, error.Message);
        }
    }

    private async Task<Outcome<string>> LoginOfAsync(string token, CancellationToken cancellation)
    {
        try
        {
            return Outcome<string>.Success(await clients.For(token).GetLoginAsync(cancellation));
        }
        catch (GitHubRequestException error)
        {
            return Outcome<string>.Failure(Problem.Invalid($"GitHub refused the token: {error.Message}"));
        }
    }

    private static string TokenOrSaved(string? token, GitHubSettings settings) => string.IsNullOrWhiteSpace(token) ? settings.Token : token.Trim();
}
