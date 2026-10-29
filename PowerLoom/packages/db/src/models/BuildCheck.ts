// The last build or test the run's sandbox ran: the command, its exit code (null when it couldn't run at all), when it
// ended, and what stopped it when it couldn't run (a sync or a restore that failed).
export interface BuildCheck {
  command: string;
  exitCode: number | null;
  at: string;
  problem: string | null;
}
