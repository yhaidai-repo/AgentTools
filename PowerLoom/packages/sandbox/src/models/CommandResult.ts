export interface CommandResult {
  /** Null when the process was killed by the timeout. */
  exitCode: number | null;
  /** Stdout and stderr as printed, cut to the head and tail when long. */
  output: string;
  truncated: boolean;
  timedOut: boolean;
  durationMs: number;
  /** The whole output in the sandbox, for grep. */
  outputFile: string;
}
