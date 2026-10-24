import type { RunOutcome } from "@agenttools/usage";

export interface AgentRunResult {
  runId: number;
  outcome: RunOutcome;
  error: string | null;
  costUsd: number;
  /** When the provider rejected the run for a rate limit, the time it resets (if known). */
  rateLimitResetsAt: Date | null;
}
