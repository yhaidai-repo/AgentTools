import type { RestoreStepResult } from "@powerloom/sandbox";

export interface RanStep {
  result: RestoreStepResult;
  /** What the agent should know about how the step ran (e.g. it fell back from locked mode); null when nothing. */
  note: string | null;
}
