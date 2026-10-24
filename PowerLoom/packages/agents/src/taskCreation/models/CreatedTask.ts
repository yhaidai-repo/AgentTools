import type { HumanTaskStep } from "@powerloom/core";
import type { Evidence } from "../../models/Evidence";
import type { TaskEffort } from "./TaskEffort";

// A task or question an agent created with create_task; written only when its run succeeds.
export interface CreatedTask {
  /** A task type from the creator's canAssign (research, design, docs), or "user". */
  assignee: string;
  kind: "task" | "question";
  title: string;
  /** The problem or question, with its facts; not the creator's guess at the answer. */
  goal: string;
  doneWhen: string;
  outOfScope: string | null;
  effort: TaskEffort;
  reason: string;
  evidence: Evidence[];
  blocking: boolean;
  /** Item ids, or `new:<n>` for the n-th task created earlier in the same run. */
  dependsOn: string[];
  options: string[];
  steps: HumanTaskStep[];
  docPath: string | null;
}
