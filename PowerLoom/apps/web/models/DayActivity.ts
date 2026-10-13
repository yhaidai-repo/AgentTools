// One budget day (00:00 UTC) of the agents' work: the runs started that day and the finished runs' cost per agent.
export interface DayActivity {
  /** YYYY-MM-DD, UTC. */
  day: string;
  runs: number;
  failures: number;
  /** Runs stopped by their budget: not failures (user decision 2026-10-13). */
  budgetStops: number;
  costByAgent: Record<string, number>;
}
