// One build or test the run's sandbox ran: the command as given, its exit code (null when it couldn't run: the sandbox
// didn't open or sync, or the service failed), why it couldn't run or what a failed restore before it said, and when.
export interface SandboxBuildRun {
  command: string;
  exitCode: number | null;
  problem: string | null;
  at: string;
}
