import type { SandboxBuildRun } from "./SandboxBuildRun";
import type { SandboxRestore } from "./SandboxRestore";

// The builds and tests the run's sandbox ran, in order, from the worktree's shell and from run_command, and the restores
// before them. The runner gives each run its own; write_implementation reads it, so a build is recorded by PowerLoom,
// not by the agent's word.
export interface RunBuildLog {
  runs: SandboxBuildRun[];
  restores: SandboxRestore[];
}
