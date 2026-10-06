// What an agent spent on the selected vault in the period: finished runs with their tokens, cost and duration.
export interface AgentTotals {
  runs: number;
  tokens: number;
  costUsd: number;
  durationMs: number;
}
