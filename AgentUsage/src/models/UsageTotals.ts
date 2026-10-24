import type { RunOutcome } from "./RunOutcome";
import type { TokenTotals } from "./TokenTotals";

// Aggregate for one group (value of the grouping label).
export interface UsageTotals extends TokenTotals {
  group: string;
  runs: number;
  failures: number;
  costUsd: number;
  durationMs: number;
  lastRunAt: Date | null;
  lastOutcome: RunOutcome | null;
}
