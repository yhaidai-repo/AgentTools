import { z } from "zod";
import type { Command } from "../models/Command";
import { adoIntegrationProblem } from "../settings";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// The Reviews page's "Check now": PowerLoom checks the vault's pull requests; one vault's checks run one after the other.
export const syncPullRequestsCommand: Command<{ vault: string }, { message: string }> = {
  name: "pullRequests.sync",
  description: "Check Azure DevOps for the vault's pull requests now (new ones become reviews waiting to be queued). Needs the vault's Azure DevOps integration.",
  input: z.object({ vault: vaultInput }),
  async run(context, input) {
    const problem = await adoIntegrationProblem(context.db, input.vault);

    if (problem) {
      return { ok: false, error: problem };
    }

    return mapOutcome(await context.powerloom.syncPullRequests(input.vault), () => ({ message: "Checking Azure DevOps; new PRs appear in a few seconds." }));
  },
};
