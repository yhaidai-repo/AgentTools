import type { agentRun, localItem, reviewComment } from "@adoa/db";
import type { ReviewRow } from "./ReviewRow";

// The review page: the row's facts plus every comment, the review tasks and their runs.
export interface ReviewDetail extends ReviewRow {
  allComments: (typeof reviewComment.$inferSelect)[];
  tasks: (typeof localItem.$inferSelect)[];
  runs: Pick<typeof agentRun.$inferSelect, "id" | "outcome" | "startedAt" | "itemId">[];
}
