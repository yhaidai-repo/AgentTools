import type { ToolDefinition } from "@agenttools/runtime";

/** Tools that one thing gives a run or a chat: every agent, a grant, the skills, the PowerLoom commands. */
export interface ToolGroup {
  source: string;
  tools: ToolDefinition<any>[];
}
