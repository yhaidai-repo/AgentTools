import type { FindingDraft } from "../../techWriter/models/FindingDraft";
import type { LinkFix } from "./LinkFix";
import type { RecordDecision } from "./RecordDecision";
import type { ReviewDecision } from "./ReviewDecision";

// Collected in memory during a review run and applied only if the run succeeds.
export interface VaultReviewDraft {
  decisions: ReviewDecision[];
  linkFixes: LinkFix[];
  records: RecordDecision[];
  findings: FindingDraft[];
  /** write_review_summary: the run's required output. */
  summary: string | null;
}
