import type { design, localItem, pbiEstimate, refinement } from "@powerloom/db";
import type { ReviewRunResult } from "./ReviewRunResult";

// One agent result with its content, as the result block and the full result page show it.
export type AgentResult =
  | { kind: "refinement"; row: typeof refinement.$inferSelect }
  | { kind: "design"; row: typeof design.$inferSelect }
  | { kind: "estimate"; row: typeof pbiEstimate.$inferSelect }
  | { kind: "item"; row: typeof localItem.$inferSelect }
  | { kind: "review"; row: ReviewRunResult };
