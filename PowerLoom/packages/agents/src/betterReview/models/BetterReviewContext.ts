import type { ReviewContext } from "../../codeReview/models/ReviewContext";
import type { OtherReviews } from "./OtherReviews";
import type { ResearchFollowUp } from "./ResearchFollowUp";
import type { ReviewRules } from "./ReviewRules";

// Code review's context plus what Better Review reads before it starts: each linked PBI in full, the repo's review
// rules, the other reviewers' threads, the research earlier runs asked for, and the last review.
export interface BetterReviewContext extends ReviewContext {
  pbiTexts: { adoId: number; text: string }[];
  rules: ReviewRules;
  otherReviews: OtherReviews;
  research: ResearchFollowUp[];
  previous: { commit: string; summaryMd: string | null } | null;
}
