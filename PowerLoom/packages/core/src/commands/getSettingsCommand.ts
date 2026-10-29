import { z } from "zod";
import type { Command } from "../models/Command";
import type { VaultSettingsView } from "../models/VaultSettingsView";
import { readVault } from "../vaults";
import { readVaultSettingsView } from "../vaultSettingsView";
import { vaultInput } from "./inputs";

export const getSettingsCommand: Command<{ vault: string }, VaultSettingsView> = {
  name: "settings.get",
  effect: "read",
  description: "Read a vault's Settings as the Settings page shows them: the Azure DevOps connection, sync, imports, pull requests, the repo catalogue with each repo's build and test commands, the sandbox (image, package hosts, private package feeds), Read SQL connections, Read Azure, DevHub and cleanup. Never a secret: only whether a token is saved. Settings are changed on the Settings page (repos also with repo_enable, repo_addLocal, repo_remove and repo_saveCommands; the sandbox also with sandbox_saveSettings, sandbox_savePackageFeed and sandbox_removePackageFeed).",
  input: z.object({ vault: vaultInput }),
  async run(context, input) {
    if (!(await readVault(context.db, input.vault))) {
      return { ok: false, error: `No vault ${input.vault} in PowerLoom.` };
    }

    return { ok: true, value: await readVaultSettingsView(context.db, input.vault) };
  },
};
