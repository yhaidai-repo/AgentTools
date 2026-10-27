import type { EventBase } from "./EventBase";
import type { RunEndReason } from "./RunEndReason";

export interface ResultEvent extends EventBase {
  type: "result";
  reason: RunEndReason;
  turns: number;
  durationMs: number;
  /** Cost the provider reported, if any; budgets use AgentUsage's own calculation. */
  providerCostUsd: number | null;
  message: string | null;
  /** False when a started provider request ended without complete measured usage. */
  usageComplete?: boolean;
}
