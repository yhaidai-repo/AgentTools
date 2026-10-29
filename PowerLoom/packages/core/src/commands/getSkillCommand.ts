import { z } from "zod";
import type { Command } from "../models/Command";
import type { SkillDetail } from "../models/SkillDetail";
import { contentHash } from "../skills/contentHash";
import { loadRevisions } from "../skills/skillRevisions";
import { loadShippedSkill } from "../skills/shippedSkill";

// One skill as its page shows it: the SKILL.md, whether PowerLoom may edit it, and the versions saves replaced.
export const getSkillCommand: Command<{ name: string }, SkillDetail> = {
  name: "skill.get",
  effect: "read",
  description: "Read a skill's SKILL.md by its name (from skill_list): the full content, its folder, whether PowerLoom may edit it (only its own skills), the content's hash a save passes back, the last 20 versions saves replaced, and for a skill PowerLoom ships when an upgrade last applied it (replacedRevisionId: the revision keeping an edited text that upgrade replaced).",
  input: z.object({ name: z.string().trim().min(1).describe("The skill's name, e.g. www-record") }),
  async run(context, input) {
    if (!context.skills.read) {
      return { ok: false, error: "Skills can't be read from here (the skill catalog has no reader)." };
    }

    const skill = await context.skills.read(input.name);

    if (!skill) {
      return { ok: false, error: `No skill named ${input.name} in the skill folders.` };
    }

    const revisions = await loadRevisions(context.db, skill.name);
    const shipped = await loadShippedSkill(context.db, skill.name);

    return { ok: true, value: { ...skill, hash: contentHash(skill.content), revisions, shipped } };
  },
};
