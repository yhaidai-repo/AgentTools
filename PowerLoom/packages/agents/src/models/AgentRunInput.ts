import type { AgentCapabilities, AgentEvent, RunLimits, ToolDefinition } from "@agenttools/runtime";

// Built during preparation (context, repos, first message).
export interface AgentRunInput {
  capabilities: AgentCapabilities;
  systemPrompt: string;
  firstMessage: string;
  tools: ToolDefinition<any>[];
  limits: RunLimits;
  perRunBudgetUsd: number;
  /** Sees every agent event of the run, e.g. to keep what the SDK's own web tools returned (ReadLog). */
  observe?: (event: AgentEvent) => void;
  /** A run counts as success only if this says its required output exists (e.g. write_refinement was called). */
  hasRequiredOutput: () => boolean;
}
