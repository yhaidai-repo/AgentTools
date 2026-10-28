import { COMMANDS, commandToolName, runCommand, type Command, type CommandContext, type PowerLoomPort } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import { defineTool, type ToolAnnotations, type ToolDefinition } from "@agenttools/runtime";
import type { z } from "zod";

// Agents run read commands only: a command that reaches PowerLoom from an agent is a bug, so it fails loudly.
const NO_POWERLOOM = new Proxy({}, { get: (_target, name) => () => Promise.reject(new Error(`agents can't run PowerLoom's ${String(name)}`)) }) as PowerLoomPort;

// A PowerLoom command as a tool (user decision 2026-10-13): one contract for the agents and for the chats, which run
// the same command through the MCP server. `fixed` inputs aren't the caller's to choose: they leave the tool's input
// and are set on every call (a chat's vault for the tools that write into it).
export function createCommandTool<I>(name: string, command: Command<I, unknown>, context: CommandContext, fixed: Record<string, unknown> = {}): ToolDefinition<any> {
  const shape = (command.input as unknown as z.ZodObject<z.ZodRawShape>).shape;

  return defineTool({
    name,
    description: command.description,
    input: Object.fromEntries(Object.entries(shape).filter(([key]) => !(key in fixed))),
    annotations: annotationsOf(command),
    handler: async (input) => {
      const outcome = await runCommand(command, context, { ...input, ...fixed });

      return outcome.ok ? { text: resultText(outcome.value) } : { text: outcome.error, isError: true };
    },
  });
}

/** Every command as a tool, named for a tool catalogue (`pbi.read` → `pbi_read`); `fixedOf` gives a command's fixed inputs. */
export function commandTools(context: CommandContext, fixedOf: (command: Command<unknown, unknown>) => Record<string, unknown> = () => ({})): ToolDefinition<any>[] {
  return COMMANDS.map((command) => createCommandTool(commandToolName(command.name), command, context, fixedOf(command)));
}

export { commandToolName };

export function agentCommandContext(db: PowerLoomDb, backlogMount: string): CommandContext {
  return { db, actor: "agent", powerloom: NO_POWERLOOM, skills: { names: async () => [] }, backlogMount };
}

// The command's effect as the hints a client gates on; a plain write has none.
function annotationsOf(command: Command<unknown, unknown>): ToolAnnotations | undefined {
  if (command.effect === "read") {
    return { readOnly: true };
  }

  return command.effect === "destructive" ? { destructive: true } : undefined;
}

// A command that answers with text (e.g. pbi.read) gives the agent just the text; anything else comes as JSON.
function resultText(value: unknown): string {
  const text = (value as { text?: unknown } | null)?.text;

  return typeof text === "string" ? text : JSON.stringify(value, null, 2);
}
