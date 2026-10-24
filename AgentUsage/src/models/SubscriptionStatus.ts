import type { SubscriptionStatusWindow } from "./SubscriptionStatusWindow";

// One provider's subscription as a host shows it: each window's current use and the recorded runs' share of it.
export interface SubscriptionStatus {
  provider: string;
  /** When the numbers were read: the end of the latest run that reported them. */
  asOf: Date | null;
  windows: SubscriptionStatusWindow[];
}
