import type { codeReview, pullRequest } from "@powerloom/db";
import type { ReviewState } from "./ReviewState";

// One review on the Reviews page: the pull request, PowerLoom's review of it, its comment counts and how far the PR moved on.
export interface ReviewRow {
  pr: typeof pullRequest.$inferSelect;
  review: typeof codeReview.$inferSelect;
  state: ReviewState;
  comments: { open: number; answered: number; total: number };
  /** Pushes since the reviewed commit; 0 when it's the PR's latest; null when unknown (never reviewed, or counted from a newer commit). */
  newPushes: number | null;
  /** True when the PR's latest commit isn't the reviewed one. */
  hasNewCommits: boolean;
}
