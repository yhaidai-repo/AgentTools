import { createPowerLoomPort } from "@powerloom/client";
import { runCommand, type Command, type CommandContext, type Outcome } from "@powerloom/core";
import { getDb } from "./db";
import { powerloom } from "./powerloom";

// Every Flow action runs its change as a command (flow.save, flow.delete, flow.run, flow.cancel), like the web's
// runWebCommand: the same contract behind the web, the MCP server and this app. Flow has no skills, backlog mount or
// agent store of its own: the flow commands need none of them.
export function runFlowCommand<I, O>(command: Command<I, O>, input: unknown): Promise<Outcome<O>> {
  return runCommand(command, flowCommandContext(), input);
}

const powerloomPort = createPowerLoomPort(powerloom);

export function flowCommandContext(): CommandContext {
  return {
    db: getDb(),
    actor: "human",
    powerloom: powerloomPort,
    skills: { names: async () => [] },
    backlogMount: process.env.BACKLOG_MOUNT ?? "",
  };
}
