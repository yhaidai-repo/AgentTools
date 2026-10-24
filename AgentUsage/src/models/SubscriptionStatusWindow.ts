export interface SubscriptionStatusWindow {
  window: string;
  label: string;
  /** 0–1, the whole account's use (other tools included). */
  utilization: number;
  resetsAt: string | null;
  /** 0–1, how much the recorded runs used of this window period (see SubscriptionPeriod). */
  share: number;
}
