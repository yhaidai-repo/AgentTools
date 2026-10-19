// What the continued run had and spent, from its trace and usage record; null where it isn't known.
export interface PreviousLimits {
  maxTurns: number | null;
  timeoutMs: number | null;
  budgetUsd: number | null;
  spentUsd: number | null;
}
