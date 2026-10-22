// A run's share of one subscription window period: the period's change split by the run's cost.
export interface RunSubscriptionShare {
  runId: string;
  provider: string;
  window: string;
  label: string;
  /** 0–1. */
  share: number;
}
