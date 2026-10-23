// What agent.create takes: what the agent is and does; everything left out takes the template's default.
export interface CreateAgentInput {
  id: string;
  label: string;
  description: string;
  prompt: string;
  handles: string[];
  skills: string[];
  canAssign: string[];
  /** Integration keys to switch on (e.g. readRepos, readSql, writeNotes); the rest stay off. */
  grants: string[];
  webAccess: boolean;
  model: { provider: string; model: string; effort?: "low" | "medium" | "high" | "xhigh" | "max" } | null;
  limits: { maxTurns: number; timeoutMinutes: number } | null;
  budgets: { perRunUsd: number; dailyUsd: number } | null;
  schedule: string | null;
  enabled: boolean;
  /** Values for the shared options (batchSize, maxFailures, …); the template's defaults otherwise. */
  options: Record<string, number>;
}
