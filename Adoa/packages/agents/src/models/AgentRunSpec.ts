import type { Stage } from "@adoa/core";
import type { ModelRef, RunLimits, ToolDefinition } from "@agenttools/runtime";
import type { UsageLabels } from "@agenttools/usage";

export interface AgentRunSpec {
  stage: Stage;
  pbiId: number;
  labels: UsageLabels;
  model: ModelRef;
  promptVersion: string;
  systemPrompt: string;
  firstMessage: string;
  tools: ToolDefinition<any>[];
  limits: RunLimits;
  perRunBudgetUsd: number;
  /** A run counts as success only if this says its required output exists (e.g. write_refinement was called). */
  hasRequiredOutput: () => boolean;
}
