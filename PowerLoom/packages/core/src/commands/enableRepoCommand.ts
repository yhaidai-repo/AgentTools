import { z } from "zod";
import type { Command } from "../models/Command";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// Settings → Repositories (user decision 2026-10-06): which repos the vault's agents may use.
export const enableRepoCommand: Command<{ vault: string; id: string; enabled: boolean }, { id: string; enabled: boolean }> = {
  name: "repo.enable",
  description: "Switch a repo of the vault on or off for its agents (Settings → Repositories). Ask the user which repo when they didn't say (settings.get lists the catalogue).",
  input: z.object({
    vault: vaultInput,
    id: z.string().trim().min(1).describe("The repo's id, as settings.get lists it"),
    enabled: z.boolean(),
  }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.setRepoEnabled(input.vault, input.id, input.enabled), () => ({ id: input.id, enabled: input.enabled }));
  },
};
