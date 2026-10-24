import { z } from "zod";
import type { Command } from "../models/Command";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

export const removeRepoCommand: Command<{ vault: string; id: string }, { id: string }> = {
  name: "repo.remove",
  effect: "destructive",
  description: "Remove a local repository from the vault's catalogue (the checkout on disk stays). Confirm with the user first, naming the repo.",
  input: z.object({ vault: vaultInput, id: z.string().trim().min(1).describe("The local repo's id, as settings_get lists it") }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.removeRepo(input.vault, input.id), () => ({ id: input.id }));
  },
};
