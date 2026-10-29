// A shell command the host ran in its own place: what the agent gets back as the command's result.
export interface ShellRouted {
  exitCode: number;
  /** Stdout and stderr together, already cut to what the agent should read. */
  output: string;
}
