import { runCommand, type Command, type CommandContext, type PowerLoomPort } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import type { z } from "zod";

// Agents run read commands only: a command that reaches PowerLoom from an agent is a bug, so it fails loudly.
const NO_POWERLOOM = new Proxy({}, { get: (_target, name) => () => Promise.reject(new Error(`agents can't run PowerLoom's ${String(name)}`)) }) as PowerLoomPort;

// A PowerLoom command as an agent tool (user decision 2026-10-13): one contract for the agents and for Claude chats,
// which run the same command through the CLI.
export function createCommandTool<I>(name: string, command: Command<I, unknown>, context: CommandContext): ToolDefinition<any> {
  return defineTool({
    name,
    description: command.description,
    input: (command.input as unknown as z.ZodObject<z.ZodRawShape>).shape,
    handler: async (input) => {
      const outcome = await runCommand(command, context, input);

      return outcome.ok ? { text: resultText(outcome.value) } : { text: outcome.error, isError: true };
    },
  });
}

export function agentCommandContext(db: PowerLoomDb, backlogMount: string): CommandContext {
  return { db, actor: "agent", powerloom: NO_POWERLOOM, skills: { names: async () => [] }, backlogMount };
}

// A command that answers with text (e.g. pbi.read) gives the agent just the text; anything else comes as JSON.
function resultText(value: unknown): string {
  const text = (value as { text?: unknown } | null)?.text;

  return typeof text === "string" ? text : JSON.stringify(value, null, 2);
}
