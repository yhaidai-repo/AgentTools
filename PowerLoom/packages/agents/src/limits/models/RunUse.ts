// What a run has used of its limits so far, as its tool results tell the agent.
export interface RunUse {
  turns: number;
  maxTurns: number;
  spentUsd: number;
  /** 0: no per-run budget. */
  budgetUsd: number;
}
