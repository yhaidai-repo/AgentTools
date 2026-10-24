import { z } from "zod";
import type { Command } from "../models/Command";
import { adoIntegrationProblem } from "../settings";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// The Backlog's Import now: PowerLoom reads the vault's import sources (the inbox, mails, recordings).
export const importNowCommand: Command<{ vault: string }, { message: string }> = {
  name: "pbi.importNow",
  description: "Import now: PowerLoom reads the vault's import sources (the import inbox) and turns new items into PBIs. Needs the vault's Azure DevOps integration.",
  input: z.object({ vault: vaultInput }),
  async run(context, input) {
    const problem = await adoIntegrationProblem(context.db, input.vault);

    if (problem) {
      return { ok: false, error: problem };
    }

    return mapOutcome(await context.powerloom.syncAdo(input.vault, null, "imports"), () => ({ message: "Import queued; the Backlog updates in a few seconds." }));
  },
};
