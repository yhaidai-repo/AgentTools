import type { design, localItem, pbiEstimate, refinement, runResult } from "@powerloom/db";
import type { PlanVersion } from "./PlanVersion";
import type { ResultQuestion } from "./ResultQuestion";
import type { ReviewRunResult } from "./ReviewRunResult";

// One agent result with its content, as the result block and the full result page show it.
export type AgentResult =
  | { kind: "refinement"; row: typeof refinement.$inferSelect }
  | { kind: "plan"; row: PlanVersion }
  | { kind: "design"; row: typeof design.$inferSelect }
  | { kind: "estimate"; row: typeof pbiEstimate.$inferSelect }
  | { kind: "item"; row: typeof localItem.$inferSelect; question: ResultQuestion | null }
  | { kind: "review"; row: ReviewRunResult }
  | { kind: "run"; row: typeof runResult.$inferSelect };
