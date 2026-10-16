// One budget day (00:00 UTC) of one agent, or of all: the runs started that day, and the finished runs' cost and run time.
export interface AgentDay {
  /** YYYY-MM-DD, UTC. */
  day: string;
  runs: number;
  finishedRuns: number;
  costUsd: number;
  durationMs: number;
}
