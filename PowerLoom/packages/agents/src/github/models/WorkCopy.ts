import type { GitHubRepoTarget } from "./GitHubRepoTarget";

// A run's own working copy of a GitHub repo: its branch, started from `base`, in a worktree at `path`.
export interface WorkCopy {
  target: GitHubRepoTarget;
  path: string;
  branch: string;
  base: string;
  pushed: boolean;
}
