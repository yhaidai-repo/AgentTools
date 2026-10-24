import { z } from "zod";
import type { Command } from "../models/Command";
import type { SavedSkill } from "../models/SavedSkill";

// PowerLoom writes PowerLoom's own skills (user decision 2026-10-01) and keeps the replaced version as a revision.
export const saveSkillCommand: Command<{ name: string; content: string; hash: string }, SavedSkill> = {
  name: "skill.save",
  description: "Rewrite one of PowerLoom's own skills (its whole SKILL.md, frontmatter with name and description included); the replaced text becomes a revision. Pass the hash skill.get gave: a skill changed since then is refused. Agents use the new text from their next run. Show the user the new text (or the diff) before calling, as the Skills page does.",
  input: z.object({
    name: z.string().trim().min(1).describe("The skill's name (skill.list)"),
    content: z.string().min(1).describe("The whole SKILL.md"),
    hash: z.string().trim().min(1).describe("The hash from skill.get of the text being replaced"),
  }),
  run(context, input) {
    return context.powerloom.saveSkill(input.name, input.content, input.hash);
  },
};
