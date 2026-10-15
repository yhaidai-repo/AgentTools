using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.AdoIntegration.Features.SyncPullRequests;

public static class PullRequestFilter
{
    // Yours to review: you by name among the reviewers (not a team you're in; assumption 2026-10-02) or the PR's author
    // (user decision 2026-10-15; until then your own PRs were left out), and pushed to.
    public static bool IsMine(AdoPullRequest pr, string user) => (IsReviewer(pr, user) || IsAuthor(pr, user)) && pr.SourceCommit is not null;

    // The repos chosen in Settings (user decision 2026-10-02); none chosen = every repo.
    public static bool IsSelectedRepo(AdoPullRequest pr, IReadOnlyList<string> repos) => repos.Count == 0 || repos.Any(repo => Same(repo, pr.RepoName));

    private static bool IsReviewer(AdoPullRequest pr, string user) => pr.Reviewers.Any(reviewer => Same(reviewer, user));

    private static bool IsAuthor(AdoPullRequest pr, string user) => pr.Author is not null && Same(pr.Author, user);

    private static bool Same(string a, string b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
}
