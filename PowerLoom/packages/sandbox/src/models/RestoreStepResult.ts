export interface RestoreStepResult {
  /** What ran, e.g. `dotnet restore src/App.sln`. */
  label: string;
  exitCode: number | null;
  durationMs: number;
  /** The step's output, cut to its head and tail when long. */
  output: string;
}
