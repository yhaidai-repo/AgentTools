export interface AgentsGlobal {
  /** Kill switch: no new runs while true. */
  paused: boolean;
  /** Set after a provider rate limit; no new runs before this ISO time. */
  pausedUntil: string | null;
  /** Cap for all agents together, per UTC day. */
  dailyBudgetUsd: number;
  /** The shared framework every `{{framework}}` prompt pulls in, as edited in Settings; empty = the file shipped with the code. */
  framework?: string;
  /** The stored framework's version; every edit is a new one. 0 while the file applies. */
  frameworkVersion?: number;
}
