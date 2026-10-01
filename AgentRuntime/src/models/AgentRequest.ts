import type { AgentCapabilities } from "./AgentCapabilities";
import type { ModelRef } from "./ModelRef";
import type { RunLimits } from "./RunLimits";
import type { ToolDefinition } from "./ToolDefinition";

export interface AgentRequest {
  runId: string;
  model: ModelRef;
  systemPrompt: string;
  firstMessage: string;
  // `any`: tools with different input shapes share one list.
  tools: ToolDefinition<any>[];
  limits: RunLimits;
  capabilities?: AgentCapabilities;
  /** Aborts the run from outside, e.g. when a budget is exceeded. */
  signal?: AbortSignal;
}
