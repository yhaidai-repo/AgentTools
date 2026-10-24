// One subscription window over a run: its utilization (0–1) when the run first saw it and when it last saw it.
// Not a run's share on its own: providers round to whole percents, often more than a run uses; runSubscriptionShares()
// splits a whole period's change by cost instead.
export interface SubscriptionUsage {
  provider: string;
  window: string;
  label: string;
  startUtilization: number;
  endUtilization: number;
  /** ISO time the window resets (as last reported). */
  resetsAt: string | null;
}
