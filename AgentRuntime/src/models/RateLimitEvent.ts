import type { EventBase } from "./EventBase";
import type { SubscriptionWindow } from "./SubscriptionWindow";

export interface RateLimitEvent extends EventBase {
  type: "rate_limit";
  status: "allowed" | "warning" | "rejected";
  resetsAt: Date | null;
  utilization: number | null;
  /** The subscription's usage windows as of this event; empty when the provider sent none. */
  windows: SubscriptionWindow[];
}
