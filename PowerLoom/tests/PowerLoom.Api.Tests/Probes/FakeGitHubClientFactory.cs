using PowerLoom.GitHubIntegration.Client;

namespace PowerLoom.Api.Tests.Probes;

// One shared fake client; it answers as the token it was last asked for.
public sealed class FakeGitHubClientFactory : IGitHubClientFactory
{
    public FakeGitHubClient Client { get; } = new();

    public IGitHubClient For(string token)
    {
        Client.Token = token;

        return Client;
    }
}
