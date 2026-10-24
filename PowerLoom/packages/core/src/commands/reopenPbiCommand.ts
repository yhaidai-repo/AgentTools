import { z } from "zod";
import type { Command } from "../models/Command";

export const reopenPbiCommand: Command<{ adoId: number }, { message: string }> = {
  name: "pbi.reopen",
  description: "Reopen a PBI closed in PowerLoom (pbi_close): it starts over as new, ready to prepare; its child items stay closed. Confirm with the user first, naming the PBI.",
  input: z.object({ adoId: z.number().int().positive() }),
  async run(context, input) {
    const reopened = await context.powerloom.reopenPbi(input.adoId, context.actor);

    return reopened.ok ? { ok: true, value: { message: reopened.value } } : reopened;
  },
};
