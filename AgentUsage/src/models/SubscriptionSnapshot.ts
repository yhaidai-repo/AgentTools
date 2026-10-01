import type { SubscriptionSample } from "./SubscriptionSample";

// A provider's latest answer to "how much of the subscription is used", asked outside runs (AgentRuntime's
// SubscriptionReport has this shape). No windows: `unavailable` says why.
export interface SubscriptionSnapshot {
  provider: string;
  plan: string | null;
  windows: SubscriptionSample[];
  checkedAt: Date;
  unavailable: string | null;
}
