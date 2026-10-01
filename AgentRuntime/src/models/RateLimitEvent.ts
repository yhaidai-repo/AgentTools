import type { EventBase } from "./EventBase";

export interface RateLimitEvent extends EventBase {
  type: "rate_limit";
  status: "warning" | "rejected";
  resetsAt: Date | null;
  utilization: number | null;
}
