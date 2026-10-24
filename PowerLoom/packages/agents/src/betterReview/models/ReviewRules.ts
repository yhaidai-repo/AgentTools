import type { ReviewRule } from "./ReviewRule";

// A repo's review rules note in the run's vault: where it is, and the rules it holds (none when it doesn't exist yet).
export interface ReviewRules {
  path: string;
  rules: ReviewRule[];
  /** False where the agent-runner can't write the vault: new rules then stay in the review's details. */
  writable: boolean;
}
