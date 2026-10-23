import { z } from "zod";
import type { Command } from "../models/Command";
import type { SavedSkill } from "../models/SavedSkill";

// A restore is a save of the old content, so the version it replaces becomes a revision too.
export const restoreSkillCommand: Command<{ name: string; revisionId: number; hash: string }, SavedSkill> = {
  name: "skill.restore",
  description: "Put a revision of one of PowerLoom's own skills back as its SKILL.md (skill.get lists the revisions with their ids); the current text becomes a revision. Pass the hash skill.get gave for the current text.",
  input: z.object({
    name: z.string().trim().min(1).describe("The skill's name (skill.list)"),
    revisionId: z.number().int().positive().describe("The revision's id from skill.get"),
    hash: z.string().trim().min(1).describe("The hash from skill.get of the current text"),
  }),
  run(context, input) {
    return context.powerloom.restoreSkill(input.name, input.revisionId, input.hash);
  },
};
