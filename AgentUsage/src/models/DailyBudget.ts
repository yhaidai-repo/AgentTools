import type { UsageLabels } from "./UsageLabels";

// Daily cap (UTC day) for runs whose labels contain `match`; an empty `match` caps all runs.
export interface DailyBudget {
  match: UsageLabels;
  limitUsd: number;
}
