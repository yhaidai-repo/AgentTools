import type { Stage } from "@adoa/core";
import type { ModelRef } from "@agenttools/runtime";
import type { UsageLabels } from "@agenttools/usage";

// Known before any preparation, so the run is visible from its first step.
export interface AgentRunInfo {
  stage: Stage;
  pbiId: number | null;
  itemId?: string;
  labels: UsageLabels;
  model: ModelRef;
  promptVersion: string;
}
