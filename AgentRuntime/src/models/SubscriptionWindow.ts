// One usage window of a provider's subscription (e.g. Claude's 5-hour limit, a monthly request allowance): how much of
// it is used, and when it resets. Adapters name and label their windows, so hosts need no provider knowledge.
export interface SubscriptionWindow {
  provider: string;
  /** The provider's id for the window, unique within the provider, e.g. "five_hour". */
  window: string;
  /** For people, e.g. "5-hour", "Weekly Sonnet", "Monthly premium requests". */
  label: string;
  /** 0–1. */
  utilization: number;
  resetsAt: Date | null;
}
