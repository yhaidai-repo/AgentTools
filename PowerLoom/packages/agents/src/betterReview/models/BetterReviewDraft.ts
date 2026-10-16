import type { ReviewDraft } from "../../codeReview/models/ReviewDraft";
import type { BetterReviewSummary } from "./BetterReviewSummary";
import type { ReviewerNote } from "./ReviewerNote";
import type { ReviewRuleDraft } from "./ReviewRuleDraft";

// Filled by Better Review's tools during the run; written only when the run succeeds. `summary` is the rendered
// markdown of `result`, so code review's commit and the review page keep working on it.
export interface BetterReviewDraft extends ReviewDraft {
  result: BetterReviewSummary | null;
  reviewerNotes: ReviewerNote[];
  rules: ReviewRuleDraft[];
}
