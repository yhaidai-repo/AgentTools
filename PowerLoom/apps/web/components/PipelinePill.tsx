import type { PipelineStatus } from "@powerloom/core";
import { stageClass, stageLabel } from "@/lib/pipelineStages";

// A PBI's pipeline status as a coloured pill (the Backlog and the PBI page).
export function PipelinePill({ status }: { status: PipelineStatus }) {
  return <span className={`stage-pill ${stageClass(status)}`}>{stageLabel(status)}</span>;
}
