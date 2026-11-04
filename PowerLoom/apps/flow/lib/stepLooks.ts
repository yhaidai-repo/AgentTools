import type { FlowExecutionStep, FlowStepStatus } from "@powerloom/core/src/models/FlowExecutionStep";

// How a step is coloured on the canvas and in the tables: the task statuses fold into seven tones.
export const STEP_TONES = ["pending", "skipped", "open", "running", "done", "blocked", "cancelled"] as const;

export type StepTone = typeof STEP_TONES[number];

const TONES: Record<FlowStepStatus, StepTone> = {
  pending: "pending",
  skipped: "skipped",
  open: "open",
  draft: "open",
  "in-progress": "running",
  done: "done",
  answered: "done",
  final: "done",
  blocked: "blocked",
  cancelled: "cancelled",
  dismissed: "cancelled",
  superseded: "cancelled",
  deleted: "cancelled",
};

export function stepTone(status: string): StepTone {
  return TONES[status as FlowStepStatus] ?? "open";
}

// A step counts as done when its task is settled well (done, answered, final).
export function isStepDone(status: string): boolean {
  return stepTone(status) === "done";
}

/** Done steps over the steps the execution reaches (every one but the skipped). */
export function executionProgress(steps: readonly Pick<FlowExecutionStep, "status">[]): { done: number; total: number } {
  const reached = steps.filter((step) => step.status !== "skipped");

  return { done: reached.filter((step) => isStepDone(step.status)).length, total: reached.length };
}

export function progressPercent(progress: { done: number; total: number }): number {
  return progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
}
