import type { GitIdentity } from "./GitIdentity";

export interface WorkspaceOptions {
  /** Where the runs' branch worktrees are kept: `<worktreeRoot>/<repo>/<branch>`. */
  worktreeRoot: string;
  /** The installed `@opengsd/gsd-core` package folder; null where the runner has none, so a GSD workspace fails. */
  gsdCore: string | null;
  /** Author and committer of the runs' commits. */
  identity: GitIdentity;
}
