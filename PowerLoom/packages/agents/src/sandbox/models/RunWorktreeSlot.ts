import type { RunWorktree } from "./RunWorktree";

// Where the run's worktree is told to the sandbox tools. The tools are built before the runner prepares the worktree
// (its runtime does that as the run starts), so they read `current` when they are called.
export interface RunWorktreeSlot {
  current: RunWorktree | null;
}
