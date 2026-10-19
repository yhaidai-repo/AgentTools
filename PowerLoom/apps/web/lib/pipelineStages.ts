import type { PipelineStatus } from "@powerloom/core";

// The pipeline's statuses in groups that share a colour (user decision 2026-10-18): refinement and research cyan, the
// user's turn amber, design violet, development blue, done the OK colour, closed and stale quiet.
const STAGE_CLASSES: Record<PipelineStatus, string> = {
  new: "stage-new",
  "ready-for-refinement": "stage-refine",
  refining: "stage-refine",
  "needs-research": "stage-refine",
  researching: "stage-refine",
  "waiting-human": "stage-human",
  "ready-for-design": "stage-design",
  designing: "stage-design",
  "ready-for-dev": "stage-dev",
  development: "stage-dev",
  done: "stage-done",
  stale: "stage-stale",
  closed: "stage-closed",
};

export function stageClass(status: PipelineStatus): string {
  return STAGE_CLASSES[status];
}

// ready-for-refinement → Ready for refinement.
export function stageLabel(status: string): string {
  const words = status.replaceAll("-", " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
}
