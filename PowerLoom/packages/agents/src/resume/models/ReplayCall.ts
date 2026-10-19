import type { ToolDefinition } from "@agenttools/runtime";

// One earlier draft call to make again, with this run's tool.
export interface ReplayCall {
  tool: ToolDefinition<any>;
  input: unknown;
}
