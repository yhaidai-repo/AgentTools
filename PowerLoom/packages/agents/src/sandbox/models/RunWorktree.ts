// The run's git worktree, when it edits and commits code there (an implementation run): the repo it belongs to and its
// folder on the runner. The sandbox copies that repo from the worktree instead of the cache, so it sees the commits.
export interface RunWorktree {
  /** The repo's name, as the repo tools name it. */
  repo: string;
  /** The worktree's folder on the runner. */
  path: string;
}
