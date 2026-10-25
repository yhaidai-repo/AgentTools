namespace PowerLoom.GitHubIntegration.Client;

public sealed class GitHubClientFactory(IHttpClientFactory httpClients) : IGitHubClientFactory
{
    public IGitHubClient For(string token) => new GitHubClient(httpClients.CreateClient(GitHubIntegrationSetup.HttpClientName), token);
}
