import type { AgentCapabilities, RunLimits, ToolDefinition } from "@agenttools/runtime";

// Built during preparation (context, repos, first message).
export interface AgentRunInput {
  capabilities: AgentCapabilities;
  systemPrompt: string;
  firstMessage: string;
  tools: ToolDefinition<any>[];
  limits: RunLimits;
  perRunBudgetUsd: number;
  /** A run counts as success only if this says its required output exists (e.g. write_refinement was called). */
  hasRequiredOutput: () => boolean;
}
