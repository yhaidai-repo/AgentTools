import type { ReviewContext } from "../../codeReview/models/ReviewContext";
import type { OtherReviews } from "./OtherReviews";
import type { ResearchFollowUp } from "./ResearchFollowUp";
import type { ReviewerNote } from "./ReviewerNote";
import type { ReviewRules } from "./ReviewRules";

// Code review's context plus what Better Review reads before it starts: each linked PBI in full, the repo's review
// rules, the other reviewers' threads, the research earlier runs asked for, and the last review.
export interface BetterReviewContext extends ReviewContext {
  pbiTexts: { adoId: number; text: string }[];
  rules: ReviewRules;
  otherReviews: OtherReviews;
  research: ResearchFollowUp[];
  /** The last review: its commit (a follow-up's anchor) and summary; a Better Review's verdicts on the threads and the
   *  newest comment it saw in each (none after a Code review). */
  previous: { commit: string; summaryMd: string | null; reviewerNotes: ReviewerNote[]; threadsSeen: Record<string, number> } | null;
}
