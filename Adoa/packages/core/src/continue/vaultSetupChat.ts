import type { ChatLauncher } from "../models/ChatLauncher";
import type { ChatPlan } from "../models/ChatPlan";
import type { CommandContext } from "../models/CommandContext";
import type { ContinueEnv } from "../models/ContinueEnv";
import type { Outcome } from "../models/Outcome";
import { readVault } from "../vaults";
import { chatHostFolder } from "./hostPaths";

// "Configure with <agent app>" after a vault was added (user decision 2026-10-06): the chat runs on the PC and adds what
// its app needs there (for Claude: the hooks and the vault in the tools' lists). The launcher's adapter says what.
export async function vaultSetupChatPlan(env: ContinueEnv, launcher: ChatLauncher, context: CommandContext, vault: string): Promise<Outcome<ChatPlan>> {
  if (!(await readVault(context.db, vault))) {
    return { ok: false, error: `${vault} isn't a vault.` };
  }

  if (!env.agentTools) {
    return { ok: false, error: "Set AGENTTOOLS_PATH in .env: the folder with VaultUsage and VaultCapture on the PC." };
  }

  const folder = chatHostFolder(env, vault);
  const request = {
    title: `Configure the vault ${vault} for ${launcher.label}`,
    intro: [`The vault's folder is ${folder}; adoa's tools (VaultUsage, VaultCapture) are in ${env.agentTools}.`],
    folder,
    extraFolders: [env.agentTools],
    steps: [
      ...launcher.vaultSetupSteps({ vaultFolder: folder, agentTools: env.agentTools }),
      `Check that ${folder} has an .obsidian folder (open it in Obsidian once if not): the tools recognise a vault by it.`,
      `Read ${folder}/AGENTS.md, then tell me in a few lines what you changed on this PC and what the vault's rules ask of you.`,
    ],
  };

  return { ok: true, value: { request, prepare: async () => null } };
}
