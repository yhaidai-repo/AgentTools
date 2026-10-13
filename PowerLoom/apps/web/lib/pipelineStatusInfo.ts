import type { PipelineStatusInfo } from "@/models/PipelineStatusInfo";

// Plain words for the pipeline statuses (the vault's adoa-workflow note has the rules behind them).
export const PIPELINE_STATUS_INFO: Record<string, PipelineStatusInfo> = {
  new: { label: "New", meaning: "synced from Azure DevOps, not prepared yet", who: "you" },
  "ready-for-refinement": { label: "Waiting for refinement", meaning: "prepared; the refinement agent picks it up on its schedule", who: "queue" },
  refining: { label: "Refining", meaning: "the refinement agent works on it", who: "agent" },
  "needs-research": { label: "Waiting for research", meaning: "research tasks wait for the research agent", who: "queue" },
  researching: { label: "Researching", meaning: "the research agent works on it", who: "agent" },
  "waiting-human": { label: "Waiting for you", meaning: "open questions or human tasks", who: "you" },
  "ready-for-design": { label: "Waiting for design", meaning: "the design agent picks it up on its schedule", who: "queue" },
  designing: { label: "Designing", meaning: "the design agent works on it", who: "agent" },
  "ready-for-dev": { label: "Ready for development", meaning: "refined and designed; you start it with Continue", who: "you" },
  development: { label: "In development", meaning: "a Continue chat implements it", who: "you" },
  done: { label: "Done", meaning: "finished in PowerLoom", who: "–" },
  stale: { label: "Stale", meaning: "changed in Azure DevOps; prepare it again", who: "you" },
  closed: { label: "Closed", meaning: "Done or Removed in Azure DevOps", who: "–" },
};

export function pipelineStatusInfo(status: string): PipelineStatusInfo {
  return PIPELINE_STATUS_INFO[status] ?? { label: status, meaning: "", who: "–" };
}
