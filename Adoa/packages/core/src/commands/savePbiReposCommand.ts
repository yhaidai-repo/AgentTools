import { z } from "zod";
import type { Command } from "../models/Command";
import { notifyChange } from "./notifyChange";

export const savePbiReposCommand: Command<{ adoId: number; repos: string[] }, { saved: number }> = {
  name: "pbi.saveRepos",
  description: "Set the repos a PBI is worked on in (research and design clone these); answers refinement's open repo question.",
  input: z.object({ adoId: z.number().int().positive(), repos: z.array(z.string().trim().min(1)) }),
  async run(context, input) {
    const saved = await context.powerloom.savePbiRepos(input.adoId, input.repos);

    if (!saved.ok) {
      return saved;
    }

    await notifyChange(context, input.adoId);

    return { ok: true, value: { saved: saved.value } };
  },
};
