namespace PowerLoom.GitHubIntegration.Client;

public interface IGitHubClientFactory
{
    IGitHubClient For(string token);
}
