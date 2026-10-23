import { z } from "zod";
import type { Command } from "../models/Command";

export const deletePbiCommand: Command<{ adoId: number }, { adoId: number }> = {
  name: "pbi.delete",
  effect: "destructive",
  description: "Delete a PBI from PowerLoom only (its tasks, questions, runs, notes); sync won't import it again. ADO is not changed. Refused while an agent runs on it.",
  input: z.object({ adoId: z.number().int().positive() }),
  async run(context, input) {
    const deleted = await context.powerloom.deletePbi(input.adoId);

    return deleted.ok ? { ok: true, value: { adoId: input.adoId } } : { ok: false, error: deleted.error };
  },
};
