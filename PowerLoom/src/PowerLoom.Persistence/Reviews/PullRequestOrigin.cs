namespace PowerLoom.Persistence.Reviews;

// Where a review's pull request row comes from (user decision 2026-10-21): the sync (a PR you review or wrote), the
// user adding an ADO PR by its branch (kept while it is active, whoever's it is), a branch without a PR in Azure DevOps
// (local), a branch only on the user's PC, not pushed (pc: found through DevHub, not code-reviewed), or a branch of a
// local repo in the repos root, no Azure DevOps needed (local-repo, user decision 2026-10-25), or a GitHub pull request
// you review or wrote (github, user decision 2026-10-25: its id is PowerLoom's own, the PR is found by its URL).
public static class PullRequestOrigin
{
    public const string Sync = "sync";
    public const string User = "user";
    public const string Local = "local";
    public const string Pc = "pc";
    public const string LocalRepo = "local-repo";
    public const string Github = "github";

    public static bool IsBranchReview(string origin) => origin is Local or Pc or LocalRepo;
}
