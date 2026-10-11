// One agent's runs in a period, from the run table: it includes runs still going (usage is recorded only at the end).
export interface RunCounts {
  runs: number;
  /** All time, whatever the period. */
  totalRuns: number;
  running: number;
  failures: number;
  lastStartedAt: Date | null;
  lastOutcome: string | null;
}
