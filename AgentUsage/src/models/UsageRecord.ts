import type { ModelUsage } from "./ModelUsage";
import type { RunOutcome } from "./RunOutcome";
import type { SubscriptionUsage } from "./SubscriptionUsage";
import type { TokenTotals } from "./TokenTotals";
import type { UsageLabels } from "./UsageLabels";

export interface UsageRecord extends TokenTotals {
  runId: string;
  labels: UsageLabels;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  turns: number;
  outcome: RunOutcome;
  error: string | null;
  /** Our calculation from tokens × prices, fixed at run time. */
  costUsd: number;
  /** What the provider reported, for comparison only. */
  providerCostUsd: number | null;
  models: ModelUsage[];
  /** The subscription's usage windows over the run; empty for API-key runs or older records. */
  subscription: SubscriptionUsage[];
}
