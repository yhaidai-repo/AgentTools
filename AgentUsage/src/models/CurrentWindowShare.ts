// How much one label value (e.g. one agent) used of a subscription window's current period.
export interface CurrentWindowShare {
  provider: string;
  window: string;
  label: string;
  /** ISO time the current period resets. */
  resetsAt: string | null;
  /** 0–1 of the whole limit. */
  share: number;
}
