import type { agentRun, localItem, reviewComment } from "@powerloom/db";
import type { UsageRecord } from "@agenttools/usage";
import type { ReviewRow } from "./ReviewRow";

// The review page: the row's facts plus every comment, the review tasks and their runs (newest first, with usage once
// a run ended).
export interface ReviewDetail extends ReviewRow {
  allComments: (typeof reviewComment.$inferSelect)[];
  tasks: (typeof localItem.$inferSelect)[];
  runs: { run: typeof agentRun.$inferSelect; usage: UsageRecord | null }[];
}
