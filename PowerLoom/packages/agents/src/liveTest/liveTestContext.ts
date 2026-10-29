import { skillCatalogOf } from "@agenttools/runtime/skills";
import { createPowerLoomClient, createPowerLoomPort } from "@powerloom/client";
import { backlogMountOf, type CommandContext } from "@powerloom/core";
import type { AgentDeps } from "../models/AgentDeps";

/** The commands' context for a live-test run, as the MCP server builds a chat's: writes go through PowerLoom's API under
 *  the agent's name (status_history actor `agent:<id>`). Skills are read only (the skill writes aren't exposed); a file to
 *  attach is named by its path under the vaults root as the runner mounts it (it has no PC paths). */
export function liveTestContext(deps: AgentDeps, agentId: string): CommandContext {
  return {
    db: deps.db,
    actor: `agent:${agentId}`,
    powerloom: createPowerLoomPort(createPowerLoomClient(deps.powerloomUrl)),
    skills: skillCatalogOf(deps.skillFolders, null),
    backlogMount: backlogMountOf(deps.vaultRoot),
    agents: deps.config,
    usage: deps.usageStore,
    hostFolders: deps.vaults ? [{ hostRoot: deps.vaults.root, mount: deps.vaults.root }] : [],
  };
}
