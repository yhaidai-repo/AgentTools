// A subscription usage window as a provider reported it (e.g. AgentRuntime's SubscriptionWindow, from a run's
// rate_limit event or from asking the runtime).
export interface SubscriptionSample {
  provider: string;
  window: string;
  label: string;
  /** 0–1. */
  utilization: number;
  resetsAt: Date | null;
}
