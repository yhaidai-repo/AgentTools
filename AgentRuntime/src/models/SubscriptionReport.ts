import type { SubscriptionWindow } from "./SubscriptionWindow";

// A provider's answer to "how much of the subscription is used". No windows means the provider couldn't tell, and
// `unavailable` says why (an API key, a token without the needed scope, a failed request).
export interface SubscriptionReport {
  provider: string;
  /** The plan as the provider names it (e.g. "max"), when it says. */
  plan: string | null;
  windows: SubscriptionWindow[];
  checkedAt: Date;
  unavailable: string | null;
}
