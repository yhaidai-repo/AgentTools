namespace PowerLoom.Persistence.Reviews;

// Where a review's pull request row comes from (user decision 2026-10-21): the sync (a PR you review or wrote), the
// user adding an ADO PR by its branch (kept while it is active, whoever's it is), or a branch without a PR.
public static class PullRequestOrigin
{
    public const string Sync = "sync";
    public const string User = "user";
    public const string Local = "local";
}
