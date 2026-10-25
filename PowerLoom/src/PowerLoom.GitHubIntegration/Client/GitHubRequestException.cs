namespace PowerLoom.GitHubIntegration.Client;

// GitHub refused a call (a bad or expired token, no access to a repo) or answered with something unexpected.
public sealed class GitHubRequestException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
