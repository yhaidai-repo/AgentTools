import type { FlowExecutionStatus, FlowTargetKind } from "@powerloom/db";
import type { FlowDefinition } from "./FlowDefinition";
import type { FlowExecutionStep } from "./FlowExecutionStep";

// One run of a flow for a PBI or a task, with the definition snapshot it started from and, per agent node, the task the
// engine (or an upstream agent) created for it (phase 2).
export interface FlowExecution {
  id: string;
  flowId: string;
  flowVersion: number;
  vault: string;
  targetKind: FlowTargetKind;
  pbiId: number | null;
  itemId: string | null;
  status: FlowExecutionStatus;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  definition: FlowDefinition;
  steps: FlowExecutionStep[];
}
