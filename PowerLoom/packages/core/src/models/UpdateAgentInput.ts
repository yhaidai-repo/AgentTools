import type { ModelChoice } from "@agenttools/config";

// What agent.update may change; every field but the id is optional and the rest of the definition stays.
export interface UpdateAgentInput {
  id: string;
  label?: string;
  description?: string;
  enabled?: boolean;
  /** A cron, or null for manual runs only. */
  schedule?: string | null;
  model?: ModelChoice;
  limits?: { maxTurns: number; timeoutMinutes: number };
  budgets?: { perRunUsd: number; dailyUsd: number };
  webAccess?: boolean;
  /** The integrations switched on, by key; every other declared integration goes off. */
  grants?: string[];
  skills?: string[];
  /** Option values, merged over the current ones; keys the agent doesn't declare are refused by AgentConfig. */
  options?: Record<string, number>;
  canAssign?: string[];
  handles?: string[];
  waitFor?: string[];
  /** The whole prompt; the file's own text puts a shipped agent back on its file. */
  prompt?: string;
}
