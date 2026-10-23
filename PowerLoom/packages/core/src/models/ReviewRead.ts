import type { ReviewCommentRead } from "./ReviewCommentRead";
import type { ReviewSummary } from "./ReviewSummary";
import type { RunOutcome } from "./RunOutcome";

// What review.get answers: the review's summary, the agents' conclusion, every comment with its answer, the review
// tasks and their runs (newest first).
export interface ReviewRead extends ReviewSummary {
  summaryMd: string | null;
  allComments: ReviewCommentRead[];
  tasks: { id: string; status: string; title: string; createdAt: Date }[];
  runs: { id: number; outcome: RunOutcome; startedAt: Date; endedAt: Date | null; costUsd: number | null }[];
}
