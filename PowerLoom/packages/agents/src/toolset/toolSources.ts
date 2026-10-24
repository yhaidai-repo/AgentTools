import type { AgentDefinition } from "@agenttools/config";
import type { ToolDefinition } from "@agenttools/runtime";
import type { OfferedTool } from "@powerloom/core";
import type { ToolGroup } from "./models/ToolGroup";
import { summaryOf } from "./toolsPromptSection";

// What gives a tool, as the Tools tab's All tools panel names it. A grant is named as the Config page names it.
export const SKILLS_SOURCE = "Skills";
export const HAND_ON_SOURCE = "Task types it may hand on";
export const READ_AZURE_SOURCE = "Read Azure";
export const COMMANDS_SOURCE = "PowerLoom commands";

export function grantSource(agent: AgentDefinition, key: string): string {
  return agent.integrationSpecs?.find((spec) => spec.key === key)?.label ?? key;
}

export function toolsOf(groups: ToolGroup[]): ToolDefinition<any>[] {
  return groups.flatMap((group) => group.tools);
}

/** The tools as the Tools tab lists them: each once, with its description's first sentence and what gave it. */
export function offeredTools(groups: ToolGroup[]): OfferedTool[] {
  const tools = groups.flatMap((group) => group.tools.map((tool) => ({ name: tool.name, summary: summaryOf(tool.description), source: group.source })));

  return tools.filter((tool, index) => tools.findIndex((other) => other.name === tool.name) === index);
}
