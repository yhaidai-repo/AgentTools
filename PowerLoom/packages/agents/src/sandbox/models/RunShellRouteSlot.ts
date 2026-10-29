import type { ShellRoute } from "@agenttools/runtime";

// Where the run's sandbox tools leave the route of its worktree shell's builds and tests (SandboxShellRoute), for the
// runner to hand to the run with its worktree. Empty while the run has no sandbox or no worktree.
export interface RunShellRouteSlot {
  current: ShellRoute | null;
}
