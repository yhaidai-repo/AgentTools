import type { RestoreStep } from "./RestoreStep";

export interface RestorePlan {
  steps: RestoreStep[];
  /** What was found but not restored, and why. */
  skipped: string[];
}
