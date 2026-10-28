import type { GitIdentity } from "./GitIdentity";

export interface GsdWorktreeOptions {
  /** The per-PBI git worktree the run uses as its cwd. */
  worktree: string;
  /** The installed `@opengsd/gsd-core` package folder. */
  gsdCore: string;
  /** Author and committer of the run's commits. */
  identity: GitIdentity;
}
