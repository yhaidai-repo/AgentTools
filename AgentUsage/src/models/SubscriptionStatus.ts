import type { SubscriptionStatusWindow } from "./SubscriptionStatusWindow";

// One provider's subscription as a host shows it: each window's current use and the recorded runs' share of it.
export interface SubscriptionStatus {
  provider: string;
  plan: string | null;
  /** When the numbers were read: the latest snapshot or run, whichever is newer. */
  asOf: Date | null;
  unavailable: string | null;
  windows: SubscriptionStatusWindow[];
}
