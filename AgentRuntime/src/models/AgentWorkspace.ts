import type { RepoRef } from "./RepoRef";

// A git worktree of its own for a run that changes code (one per PBI branch). The runtime never resolves it: the host
// turns it into the run's `cwd`, setting sources and `env` before the run, and the adapters ignore it.
export interface AgentWorkspace {
  /** The repo, as the host's repo cache knows it. */
  repo: RepoRef;
  /** The run's local branch; created from `baseBranch` the first time, reused with its commits after that. */
  branch: string;
  /** The remote branch a new `branch` starts from. */
  baseBranch: string;
  /** Prepares the worktree for GSD (its planning folder, local install and settings) before the run. */
  gsd: boolean;
}
