import { z } from "zod";
import type { Command } from "../models/Command";
import { pbiIdInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";
import { skippedPbis } from "./skippedPbis";

// The Backlog's and the PBI page's "Start planning": notes written where missing, a design task each for the planning agent.
export const planPbisCommand: Command<{ adoIds: number[] }, { queued: number[]; skipped: string[]; message: string }> = {
  name: "pbi.plan",
  description: "Start planning one or several PBIs: PowerLoom writes their notes and queues a design task each, which the planning agent takes (it starts on its schedule or agent_run). Closed PBIs are skipped (reopen first). Ask the user which PBIs when they didn't name them; never pick them yourself.",
  input: z.object({ adoIds: z.array(pbiIdInput).min(1).describe("The PBIs to plan") }),
  async run(context, input) {
    const planned = await context.powerloom.planPbis(input.adoIds);

    return mapOutcome(planned, (value) => ({ queued: value.queued, skipped: skippedPbis(value), message: `${value.queued.length} PBI(s) queued: notes written and a planning task each.` }));
  },
};
