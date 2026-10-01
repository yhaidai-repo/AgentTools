import type { RunOutcome } from "./RunOutcome";

export interface FinishInfo {
  outcome: RunOutcome;
  turns: number;
  error?: string | null;
  providerCostUsd?: number | null;
}
