namespace PowerLoom.GitHubIntegration.Client.Models;

// An open pull request: `HeadRef`/`BaseRef` are branch names, `HtmlUrl` its page.
public sealed record GitHubPullRequest(string Owner, string Repo, int Number, string Title, string? Body, string Author, string HeadRef, string HeadSha, string BaseRef, string BaseSha, bool IsDraft, IReadOnlyList<string> RequestedReviewers, DateTime CreatedAt, string HtmlUrl)
{
    public string Key => GitHubPullRequestKey.Of(Owner, Repo, Number);
}
