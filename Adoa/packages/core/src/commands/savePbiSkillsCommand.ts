import { z } from "zod";
import type { Command } from "../models/Command";
import type { PbiSkillChoices } from "../models/PbiSkillChoices";
import { pbiSkillProblems, savePbiSkillChoices } from "../pbiSkills";
import { notifyChange } from "./notifyChange";

export const savePbiSkillsCommand: Command<PbiSkillChoices, { saved: number }> = {
  name: "pbi.saveSkills",
  description: "Set the skills every later agent on a PBI loads (at most 5); from then on refinement leaves the list.",
  input: z.object({ adoId: z.number().int().positive(), skills: z.array(z.object({ name: z.string().trim().min(1), reason: z.string().trim().default("") })) }),
  async run(context, input) {
    const problems = pbiSkillProblems(input.skills.map((skill) => skill.name), await context.skills.names());

    if (problems.length > 0) {
      return { ok: false, error: `Not saved: ${problems.join("; ")}.` };
    }

    await savePbiSkillChoices(context.db, input.adoId, input.skills);
    await notifyChange(context, input.adoId);

    return { ok: true, value: { saved: input.skills.length } };
  },
};
