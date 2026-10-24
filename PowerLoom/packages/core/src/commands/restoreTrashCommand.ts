import { z } from "zod";
import type { Command } from "../models/Command";
import { trashPathInput, vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// The Vault page's trash (the web's vault mount is read-only, so PowerLoom moves the file).
export const restoreTrashCommand: Command<{ vault: string; path: string }, { path: string }> = {
  name: "vault.trashRestore",
  description: "Put a trashed note back where it was in the vault. Ask the user which note when they didn't say (vault_trash lists them).",
  input: z.object({ vault: vaultInput, path: trashPathInput }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.restoreTrash(input.vault, input.path), (path) => ({ path }));
  },
};
