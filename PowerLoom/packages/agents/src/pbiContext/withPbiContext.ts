import { backlogMountOf, buildPbiContext, hasPbiContext } from "@powerloom/core";
import { workItem } from "@powerloom/db";
import type { ToolDefinition } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { createAttachmentTool } from "../attachmentTools";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunInput } from "../models/AgentRunInput";
import { createReadPbiTool } from "./readPbiTool";

// Every run on a PBI gets the PBI's context and the tools that read its references, whatever the agent, also agents
// added later (user decision 2026-10-13). An executor that put the context in its first message already keeps it.
export async function withPbiContext(deps: AgentDeps, pbiId: number | null, input: AgentRunInput): Promise<AgentRunInput> {
  if (pbiId === null) {
    return input;
  }

  const tools = [createReadPbiTool(deps.db, deps.vaultRoot), createAttachmentTool(deps.db, pbiId)];

  return { ...input, firstMessage: await withContextMessage(deps, pbiId, input.firstMessage), tools: [...input.tools, ...missing(tools, input.tools)] };
}

async function withContextMessage(deps: AgentDeps, pbiId: number, firstMessage: string): Promise<string> {
  if (hasPbiContext(firstMessage)) {
    return firstMessage;
  }

  const [row] = await deps.db.select().from(workItem).where(eq(workItem.adoId, pbiId));

  return row ? `${firstMessage}\n\n${await buildPbiContext(deps.db, backlogMountOf(deps.vaultRoot), row)}` : firstMessage;
}

function missing(tools: ToolDefinition<any>[], present: ToolDefinition<any>[]): ToolDefinition<any>[] {
  const names = new Set(present.map((tool) => tool.name));

  return tools.filter((tool) => !names.has(tool.name));
}
