// A routed build or test as the shell gets it back (exit code and output), with what the run's build log keeps: whether
// it ran in the sandbox at all, and why not or what a failed restore before it said.
export interface RoutedBuild {
  ran: boolean;
  exitCode: number;
  output: string;
  problem: string | null;
}
