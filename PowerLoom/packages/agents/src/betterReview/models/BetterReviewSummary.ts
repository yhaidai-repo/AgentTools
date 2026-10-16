import type { ResultStatus } from "../../models/ResultStatus";
import type { CriterionCheck } from "./CriterionCheck";

// What write_review_summary saves for Better Review; the review page shows it, the summary markdown is rendered from it.
export interface BetterReviewSummary {
  verdict: "ready" | "ready_with_fixes" | "not_ready";
  assessment: string;
  status: ResultStatus;
  goals: { pbi: string; goal: string }[];
  criteria: CriterionCheck[];
  businessLogic: string;
  risks: string[];
  notReviewed: { what: string; why: string }[];
  nextReason: string;
}
