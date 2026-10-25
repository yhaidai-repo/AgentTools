using PowerLoom.GitHubIntegration.Client;
using PowerLoom.GitHubIntegration.Client.Models;

namespace PowerLoom.Api.Tests.Probes;

// GitHub as the tests set it up: a token in `BadTokens` is refused like GitHub refuses one (401).
public sealed class FakeGitHubClient : IGitHubClient
{
    public string Token { get; set; } = "";

    public HashSet<string> BadTokens { get; } = [];

    public string Login { get; set; } = "sam";

    public List<GitHubRepository> Repositories { get; set; } = [];

    public Dictionary<string, List<GitHubPullRequest>> Pulls { get; } = new(StringComparer.OrdinalIgnoreCase);

    public List<string> Reviewed { get; set; } = [];

    public Task<string> GetLoginAsync(CancellationToken cancellation) => Answer(Login);

    public Task<IReadOnlyList<GitHubRepository>> ListRepositoriesAsync(CancellationToken cancellation) => Answer<IReadOnlyList<GitHubRepository>>(Repositories);

    public Task<IReadOnlyList<GitHubPullRequest>> ListOpenPullRequestsAsync(string owner, string repo, CancellationToken cancellation)
    {
        return Answer<IReadOnlyList<GitHubPullRequest>>(Pulls.TryGetValue($"{owner}/{repo}", out var pulls) ? pulls : []);
    }

    public Task<IReadOnlyList<string>> ListReviewedPullRequestsAsync(string login, CancellationToken cancellation) => Answer<IReadOnlyList<string>>(Reviewed);

    private Task<T> Answer<T>(T value)
    {
        if (BadTokens.Contains(Token))
            throw new GitHubRequestException(401, "GitHub answered 401 for /user: Bad credentials");

        return Task.FromResult(value);
    }
}
