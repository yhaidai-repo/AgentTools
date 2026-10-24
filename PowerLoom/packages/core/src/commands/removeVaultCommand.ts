import { z } from "zod";
import type { Command } from "../models/Command";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

export const removeVaultCommand: Command<{ vault: string }, { vault: string; message: string }> = {
  name: "vault.remove",
  effect: "destructive",
  description: "Remove a vault from PowerLoom: PowerLoom forgets it and stops its schedules; its folder, notes and history stay on disk. Confirm with the user first, naming the vault and saying the folder stays.",
  input: z.object({ vault: vaultInput }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.removeVault(input.vault), (vault) => ({ vault, message: `${vault} removed. Its folder is untouched.` }));
  },
};
