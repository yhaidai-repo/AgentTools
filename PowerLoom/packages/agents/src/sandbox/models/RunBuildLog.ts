import type { SandboxBuildRun } from "./SandboxBuildRun";

// The builds and tests the run's sandbox ran, in order, from the worktree's shell and from run_command. The runner
// gives each run its own; write_implementation reads it, so a build is recorded by PowerLoom, not by the agent's word.
export interface RunBuildLog {
  runs: SandboxBuildRun[];
}
