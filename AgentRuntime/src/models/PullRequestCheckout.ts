// A pull request checked out for one run: a worktree at the PR's source commit, and where its changes start.
export interface PullRequestCheckout {
  /** The worktree folder (removed with RepoCache.removeCheckout). */
  path: string;
  sourceCommit: string;
  targetCommit: string;
  /** The commit the PR's changes are measured from: merge-base of source and target. */
  mergeBase: string;
}
