// One period of one subscription window (between two resets) as the recorded runs saw it. `change` runs from the first
// run's starting reading to the last run's ending reading: over a whole period the provider's whole-percent rounding
// is small, unlike per run. It includes the account's other use during that span.
export interface SubscriptionPeriod {
  provider: string;
  window: string;
  label: string;
  resetsAt: string | null;
  /** 0–1. */
  change: number;
  /** The runs' API-equivalent cost in the period, the basis for splitting `change`. */
  costUsd: number;
  runIds: string[];
}
