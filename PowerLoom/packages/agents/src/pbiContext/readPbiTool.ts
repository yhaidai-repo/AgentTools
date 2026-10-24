import { backlogMountOf, readPbiCommand } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import type { ToolDefinition } from "@agenttools/runtime";
import { agentCommandContext, createCommandTool } from "../commandTool";

// read_pbi: the pbi.read command as an agent tool; `vaultRoot` is the run's vault's backlog root (deps.vaultRoot).
export function createReadPbiTool(db: PowerLoomDb, vaultRoot: string): ToolDefinition<any> {
  return createCommandTool("read_pbi", readPbiCommand, agentCommandContext(db, backlogMountOf(vaultRoot)));
}
