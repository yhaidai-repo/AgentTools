import type { ShellRouted } from "./ShellRouted";

// The host's own place for some of a run's shell commands (PowerLoom: builds and tests in its sandbox, as the run's own
// shell has no toolchains). Asked before the run's guards for every shell call, its sub-agents' included; a command it
// runs comes back as that call's result, as if the run's shell had run it.
export interface ShellRoute {
  /** The result when the host ran `command` (from the shell's folder `cwd`, with the call's timeout if it gave one);
   *  null when the command stays with the run's own shell and its guards. */
  run(command: string, cwd: string, timeoutMs: number | null): Promise<ShellRouted | null>;
}
