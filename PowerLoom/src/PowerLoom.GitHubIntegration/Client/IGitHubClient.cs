using PowerLoom.GitHubIntegration.Client.Models;

namespace PowerLoom.GitHubIntegration.Client;

// GitHub's REST API as PowerLoom reads it; nothing is ever written to GitHub.
public interface IGitHubClient
{
    /// <summary>The token's user (its login).</summary>
    Task<string> GetLoginAsync(CancellationToken cancellation);

    /// <summary>Every repo the token can read.</summary>
    Task<IReadOnlyList<GitHubRepository>> ListRepositoriesAsync(CancellationToken cancellation);

    Task<IReadOnlyList<GitHubPullRequest>> ListOpenPullRequestsAsync(string owner, string repo, CancellationToken cancellation);

    /// <summary>Open pull requests the user has reviewed, as `owner/repo#number`.</summary>
    Task<IReadOnlyList<string>> ListReviewedPullRequestsAsync(string login, CancellationToken cancellation);
}
