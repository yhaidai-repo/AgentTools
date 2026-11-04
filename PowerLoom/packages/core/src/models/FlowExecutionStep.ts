import type { localItem } from "@powerloom/db";

export type FlowStepStatus = typeof localItem.$inferSelect["status"] | "pending" | "skipped";

// One agent node of an execution and the task that stands for it (PowerLoom Flow phase 2; the backend's FlowStepView):
// the task's status, or "pending" while the execution runs without one, "skipped" once it finished without.
export interface FlowExecutionStep {
  nodeId: string;
  itemId: string | null;
  status: FlowStepStatus;
  runs: number;
  agent: string;
  kind: string;
}
