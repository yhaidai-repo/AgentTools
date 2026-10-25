namespace PowerLoom.GitHubIntegration.Client.Models;

// `owner/repo#number`, case-insensitive like GitHub's names.
public static class GitHubPullRequestKey
{
    public static string Of(string owner, string repo, int number) => $"{owner}/{repo}#{number}".ToLowerInvariant();
}
