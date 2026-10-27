// One agent's work in the period: runs and failures from the run table, cost, tokens and duration from the finished
// runs' usage records.
export interface AgentActivity {
  agentId: string;
  runs: number;
  failures: number;
  finishedRuns: number;
  costUsd: number;
  accountingComplete?: boolean;
  tokens: number;
  durationMs: number;
}
