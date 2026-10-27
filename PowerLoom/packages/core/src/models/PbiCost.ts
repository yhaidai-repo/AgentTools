// What the agents' finished runs on one PBI cost in a period.
export interface PbiCost {
  pbiId: number;
  title: string;
  runs: number;
  costUsd: number;
  accountingComplete?: boolean;
  durationMs: number;
}
