import { z } from "zod";
import type { Command } from "../models/Command";
import { pbiIdInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";

// The Backlog's and the PBI page's Prepare: notes written, a refinement task each.
export const preparePbisCommand: Command<{ adoIds: number[] }, { queued: number[]; skipped: string[]; message: string }> = {
  name: "pbi.prepare",
  description: "Prepare one or several PBIs: PowerLoom writes their notes and queues a refinement task each (it starts on the refinement schedule or agent.run). Closed PBIs are skipped (reopen first). Ask the user which PBIs when they didn't name them; never pick them yourself.",
  input: z.object({ adoIds: z.array(pbiIdInput).min(1).describe("The PBIs to prepare") }),
  async run(context, input) {
    const prepared = await context.powerloom.preparePbis(input.adoIds);

    return mapOutcome(prepared, (value) => {
      const skipped = [...value.closed.map((adoId) => `PBI-${adoId} is closed: reopen it first.`), ...value.unknown.map((adoId) => `PBI-${adoId} isn't in PowerLoom.`)];

      return { queued: value.queued, skipped, message: `${value.queued.length} PBI(s) queued: notes written and a refinement task each.` };
    });
  },
};
