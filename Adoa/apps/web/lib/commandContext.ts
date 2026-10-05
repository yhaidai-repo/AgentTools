import { DEFAULT_CHAT_LAUNCHER, runCommand, type BacklogNotes, type Command, type CommandContext, type ContinueEnv, type Outcome } from "@adoa/core";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { getDb } from "./db";
import { bossJobPort } from "./jobPort";
import { backlogFolder, vaultHostPath } from "./obsidian";
import { loadSkillCatalog } from "./skills";

// Every web action runs its change as a command (user decision 2026-10-05), so the web, and later an MCP server, share
// one contract per change. This is the web's side: the person at the browser, pg-boss, its read-only vault mount.
export function runWebCommand<I, O>(command: Command<I, O>, input: unknown): Promise<Outcome<O>> {
  return runCommand(command, webCommandContext(), input);
}

export function webCommandContext(): CommandContext {
  return {
    db: getDb(),
    actor: "human",
    jobs: bossJobPort,
    notes: backlogNotes,
    skills: { names: async () => (await loadSkillCatalog()).skills.map((skill) => skill.name) },
    docsVaultName: process.env.DOCS_VAULT_NAME?.trim() || null,
    continueEnv: continueEnv(),
  };
}

// VAULT_ROOT is the backlog folder of the vault, mounted read-only.
const backlogNotes: BacklogNotes = {
  async exists(backlogRelativePath) {
    const root = process.env.VAULT_ROOT;

    if (!root) {
      return false;
    }

    try {
      await access(join(root, backlogRelativePath));

      return true;
    } catch {
      return false;
    }
  },
};

// PC paths for "continue with agent" chats; null until the vaults root and repos root are set.
function continueEnv(): ContinueEnv | null {
  const folder = hostPath(process.env.CONTINUE_FOLDER);
  const reposRoot = hostPath(process.env.REPOS_ROOT);
  const vault = vaultHostPath();

  if (!folder || !reposRoot || !vault) {
    return null;
  }

  return { launcher: process.env.CONTINUE_LAUNCHER?.trim() || DEFAULT_CHAT_LAUNCHER, folder, reposRoot, vault, backlogFolder: backlogFolder() };
}

function hostPath(value: string | undefined): string | null {
  return value?.trim().replaceAll("\\", "/").replace(/\/+$/, "") || null;
}
