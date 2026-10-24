import { z } from "zod";
import type { Command } from "../models/Command";
import { trashPathInput, vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

export const deleteTrashCommand: Command<{ vault: string; path: string }, { path: string }> = {
  name: "vault.trashDelete",
  effect: "destructive",
  description: "Delete a trashed note for good. Confirm with the user first, naming the note.",
  input: z.object({ vault: vaultInput, path: trashPathInput }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.deleteTrash(input.vault, input.path), (path) => ({ path }));
  },
};
