export interface SessionOutput {
  sessionId: string;
  /** What the process printed since the last read. */
  output: string;
  truncated: boolean;
  running: boolean;
  /** Set once the process has exited. */
  exitCode: number | null;
}
