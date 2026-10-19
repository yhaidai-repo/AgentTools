import type { AgentCapabilities } from "./AgentCapabilities";
import type { Conversation } from "./Conversation";
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
  /** Keeps the run's conversation (and continues an earlier one) when the runtime keeps conversations; else ignored. */
  conversation?: Conversation;
  /** Aborts the run from outside, e.g. when a budget is exceeded. */
  signal?: AbortSignal;
}
