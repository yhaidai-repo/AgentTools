import { z } from "zod";
import { readPbiOverview } from "../bugs/pbiOverview";
import type { Command } from "../models/Command";
import type { PbiOverview } from "../models/PbiOverview";
import { parsePbiReference } from "../pbiAdmin";

export const getPbiCommand: Command<{ link: string }, PbiOverview> = {
  name: "pbi.get",
  description: "Read a PBI by its Azure DevOps or PowerLoom link, #id or id: fields, ADO state, pipeline status, parent, child items, bug record, repos, skills and note path. A child item's parent is the PBI whose branch it is worked on.",
  input: z.object({ link: z.string().trim().min(1) }),
  async run(context, input) {
    const adoId = parsePbiReference(input.link);

    if (adoId === null) {
      return { ok: false, error: `Not a PBI link or id: ${input.link}` };
    }

    const overview = await readPbiOverview(context.db, adoId);

    return overview ? { ok: true, value: overview } : { ok: false, error: `PBI-${adoId} isn't in PowerLoom.` };
  },
};
