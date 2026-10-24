import { runCommand, type Command, type CommandContext, type Outcome } from "@powerloom/core";
import { createPowerLoomPort } from "@powerloom/client";
import type { UploadedFile } from "@powerloom/attachments";
import { getAgentConfig } from "./agentConfig";
import { backlogMount } from "./backlogMount";
import { getDb } from "./db";
import { powerloom } from "./powerloom";
import { skillCatalogOf } from "@agenttools/runtime/skills";
import { editableSkillFolder, skillFolders } from "./skills";
import { getUsageStore } from "./usage";

// Every web action runs its change as a command (user decision 2026-10-05), so the web, the CLI and the MCP server
// share one contract per change. This is the web's side: the person at the browser, PowerLoom, the skill folders.
export function runWebCommand<I, O>(command: Command<I, O>, input: unknown): Promise<Outcome<O>> {
  return runCommand(command, webCommandContext(), input);
}

const powerloomPort = createPowerLoomPort(powerloom);

export function webCommandContext(): CommandContext {
  return {
    db: getDb(),
    actor: "human",
    powerloom: powerloomPort,
    skills: skillCatalogOf(skillFolders().map((folder) => folder.path), editableSkillFolder()),
    backlogMount: backlogMount(),
    agents: getAgentConfig(),
    usage: getUsageStore(),
  };
}

// Uploads for a PBI (several at once; none is stored when one can't be used), optionally for the item they answer and
// the linked document they replace. The refs (ATT-nnn) of the stored files.
export function uploadAttachments(adoId: number, files: UploadedFile[], target: { itemId: string | null; sourceUrl: string | null }): Promise<Outcome<string[]>> {
  return powerloomPort.attachToPbi(adoId, files, target);
}
