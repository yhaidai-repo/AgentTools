import { z } from "zod";
import type { Command } from "../models/Command";
import { adoIntegrationProblem } from "../settings";
import { parsePbiReference } from "../pbiAdmin";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// The Backlog's Sync now and "Sync one PBI": PowerLoom holds the ADO token, so it fetches.
export const syncPbisCommand: Command<{ vault: string; pbi: string | null }, { message: string }> = {
  name: "pbi.sync",
  description: "Sync PBIs from Azure DevOps now: the vault's sprint (the sprint picked in Settings), or one PBI or Task by id or ADO link. Needs the vault's Azure DevOps integration. Ask the user whether they mean the whole sprint or one PBI when it isn't clear.",
  input: z.object({
    vault: vaultInput,
    pbi: z.string().trim().min(1).nullable().default(null).describe("One PBI or Task id, or its ADO link; null syncs the vault's sprint"),
  }),
  async run(context, input) {
    const problem = await adoIntegrationProblem(context.db, input.vault);

    if (problem) {
      return { ok: false, error: problem };
    }

    const adoId = input.pbi === null ? null : parsePbiReference(input.pbi);

    if (input.pbi !== null && adoId === null) {
      return { ok: false, error: "Not a PBI or Task id, nor its Azure DevOps link." };
    }

    const queued = await context.powerloom.syncAdo(input.vault, adoId, adoId === null ? "sprint" : null);

    return mapOutcome(queued, () => ({ message: adoId === null ? "Sync queued: the sprint's PBIs update in a moment." : `PBI-${adoId} queued; a failure shows on the Runs page.` }));
  },
};
