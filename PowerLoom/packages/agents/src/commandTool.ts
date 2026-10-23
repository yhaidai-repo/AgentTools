import { COMMANDS, runCommand, type Command, type CommandContext, type PowerLoomPort } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import { defineTool, type ToolAnnotations, type ToolDefinition } from "@agenttools/runtime";
import type { z } from "zod";

// Agents run read commands only: a command that reaches PowerLoom from an agent is a bug, so it fails loudly.
const NO_POWERLOOM = new Proxy({}, { get: (_target, name) => () => Promise.reject(new Error(`agents can't run PowerLoom's ${String(name)}`)) }) as PowerLoomPort;

const READ_ONLY: ToolAnnotations = { readOnly: true };
const DESTRUCTIVE: ToolAnnotations = { destructive: true };

// What a client may gate on per command; a command not listed is a plain write.
const ANNOTATIONS: Record<string, ToolAnnotations> = {
  "pbi.read": READ_ONLY,
  "pbi.get": READ_ONLY,
  "sql.query": READ_ONLY,
  "sql.describe": READ_ONLY,
  "sql.databases": READ_ONLY,
  "pbi.delete": DESTRUCTIVE,
  "pbi.finish": DESTRUCTIVE,
  "pbi.close": DESTRUCTIVE,
  "review.delete": DESTRUCTIVE,
};

// A PowerLoom command as a tool (user decision 2026-10-13): one contract for the agents and for Claude chats, which
// run the same command through the CLI or the MCP server.
export function createCommandTool<I>(name: string, command: Command<I, unknown>, context: CommandContext): ToolDefinition<any> {
  return defineTool({
    name,
    description: command.description,
    input: (command.input as unknown as z.ZodObject<z.ZodRawShape>).shape,
    annotations: ANNOTATIONS[command.name],
    handler: async (input) => {
      const outcome = await runCommand(command, context, input);

      return outcome.ok ? { text: resultText(outcome.value) } : { text: outcome.error, isError: true };
    },
  });
}

/** Every command as a tool, named for a tool catalogue (`pbi.read` → `pbi_read`). */
export function commandTools(context: CommandContext): ToolDefinition<any>[] {
  return COMMANDS.map((command) => createCommandTool(commandToolName(command.name), command, context));
}

// MCP tool names allow no dot.
export function commandToolName(commandName: string): string {
  return commandName.replace(/\./g, "_");
}

export function agentCommandContext(db: PowerLoomDb, backlogMount: string): CommandContext {
  return { db, actor: "agent", powerloom: NO_POWERLOOM, skills: { names: async () => [] }, backlogMount };
}

// A command that answers with text (e.g. pbi.read) gives the agent just the text; anything else comes as JSON.
function resultText(value: unknown): string {
  const text = (value as { text?: unknown } | null)?.text;

  return typeof text === "string" ? text : JSON.stringify(value, null, 2);
}
