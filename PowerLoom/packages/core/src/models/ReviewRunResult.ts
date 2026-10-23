import type { codeReviewVersion, reviewComment } from "@powerloom/db";

// One review run of a pull request as a result version: what it concluded (kept since 2026-10-21) and the comments it
// left. A run from before then has no stored version, only its comments.
export interface ReviewRunResult {
  /** The run is the version's id. */
  id: number;
  prId: number;
  pbiId: number | null;
  taskId: string;
  version: typeof codeReviewVersion.$inferSelect | null;
  comments: (typeof reviewComment.$inferSelect)[];
}
