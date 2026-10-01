import type { StageSettings } from "./StageSettings";

export interface AgentSettings {
  /** Kill switch: no new agent runs while true. */
  paused: boolean;
  /** Set after a provider rate limit; no new runs before this ISO time. */
  pausedUntil: string | null;
  /** Cap for all agents together, per UTC day. */
  dailyBudgetUsd: number;
  refinement: StageSettings;
}
