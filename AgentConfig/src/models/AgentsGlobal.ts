export interface AgentsGlobal {
  /** Kill switch: no new runs while true. */
  paused: boolean;
  /** Set after a provider rate limit; no new runs before this ISO time. */
  pausedUntil: string | null;
  /** Cap for all agents together, per UTC day. */
  dailyBudgetUsd: number;
}
