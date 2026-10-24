import { z } from "zod";
import type { Command } from "../models/Command";
import type { PbiSkillChoices } from "../models/PbiSkillChoices";

export const savePbiSkillsCommand: Command<PbiSkillChoices, { saved: number }> = {
  name: "pbi.saveSkills",
  description: "Set the skills every later agent on a PBI loads (at most 5); from then on refinement leaves the list. Offer the known skills (skill_list) and set what the user chose, as the PBI page's skill picker does.",
  input: z.object({ adoId: z.number().int().positive(), skills: z.array(z.object({ name: z.string().trim().min(1), reason: z.string().trim().default("") })) }),
  async run(context, input) {
    const saved = await context.powerloom.savePbiSkills(input);

    if (!saved.ok) {
      return saved;
    }

    return { ok: true, value: { saved: saved.value } };
  },
};
