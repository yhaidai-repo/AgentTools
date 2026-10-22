// A run's share of one subscription window period: the period's change split by the run's cost.
export interface RunSubscriptionShare {
  runId: string;
  provider: string;
  window: string;
  label: string;
  /** ISO time the window period resets, which tells the period. */
  resetsAt: string | null;
  /** 0–1. */
  share: number;
}
