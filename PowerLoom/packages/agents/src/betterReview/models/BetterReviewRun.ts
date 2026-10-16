import type { ReviewRun } from "../../codeReview/models/ReviewRun";
import type { BetterReviewContext } from "./BetterReviewContext";
import type { BetterReviewDraft } from "./BetterReviewDraft";
import type { ReviewMode } from "./ReviewMode";

// One Better Review run's state: code review's, with its own context, draft and mode.
export interface BetterReviewRun extends ReviewRun {
  context: BetterReviewContext | null;
  draft: BetterReviewDraft;
  mode: ReviewMode;
  /** Follow-up: the PR's full patch per changed file, for get_pr_diff(full: true). */
  fullPatches: Map<string, string>;
  /** Queued by the PR sync for other reviewers' new comments: the threads that have them. */
  triggerThreads: number[] | null;
}
