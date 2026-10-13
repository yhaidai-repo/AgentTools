// What agents spent (per agent on the selected vault in a period, or on one PBI): finished runs with their tokens,
// cost and duration.
export interface AgentTotals {
  runs: number;
  tokens: number;
  costUsd: number;
  durationMs: number;
}
