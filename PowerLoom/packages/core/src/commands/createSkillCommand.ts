import { z } from "zod";
import type { Command } from "../models/Command";
import type { CreateSkillInput } from "../models/CreateSkillInput";

const SKILL_NAME = /^[a-z0-9][a-z0-9-]*$/;

// A skill of PowerLoom's own: `<name>/SKILL.md` in PowerLoom's skills folder, with the frontmatter agents choose it
// by. The caller (a chat, the New agent page) has asked what the skill is for before; this command only writes a valid one.
export const createSkillCommand: Command<CreateSkillInput, { name: string }> = {
  name: "skill.create",
  description: "Create a PowerLoom skill (a SKILL.md agents may load): its folder name, the one-line description agents choose it by, and its Markdown body (checklists, rules, examples). Refused when a skill of that name exists in any folder. Ask first what the skill is for, when an agent should load it, and what it must contain.",
  input: z.object({
    name: z.string().trim().regex(SKILL_NAME, "lower-case letters, digits and dashes").max(80),
    description: z.string().trim().min(10).max(400),
    body: z.string().trim().min(20),
  }),
  async run(context, input) {
    const names = await context.skills.names();

    if (names.includes(input.name)) {
      return { ok: false, error: `A skill named ${input.name} exists already; edit it on its page instead.` };
    }

    const created = await context.powerloom.createSkill(input.name, skillFile(input));

    return created.ok ? { ok: true, value: { name: input.name } } : created;
  },
};

function skillFile(input: CreateSkillInput): string {
  return ["---", `name: ${input.name}`, `description: ${input.description.replace(/\r?\n/g, " ")}`, "---", "", input.body.replace(/\r\n/g, "\n"), ""].join("\n");
}
