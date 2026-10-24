import type { ModelRef } from "@agenttools/runtime";
import type { UsageLabels } from "@agenttools/usage";

// Known before any preparation, so the run is visible from its first step.
export interface AgentRunInfo {
  /** The agent id (agent_run.stage). */
  stage: string;
  pbiId: number | null;
  itemId?: string;
  labels: UsageLabels;
  model: ModelRef;
  promptVersion: string;
}
