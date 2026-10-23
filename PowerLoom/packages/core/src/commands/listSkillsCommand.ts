import type { AgentDefinition } from "@agenttools/config";
import { z } from "zod";
import type { Command } from "../models/Command";
import type { SkillListEntry } from "../models/SkillListEntry";
import type { SkillSummary } from "../models/SkillSummary";

// The skills agents may load, from the caller's skill folders, with the agents whose definition lists each one.
export const listSkillsCommand: Command<Record<string, never>, SkillListEntry[]> = {
  name: "skill.list",
  effect: "read",
  description: "List the skills agents may load: name, the description agents choose it by, the folder it lives in, and the agents whose definition lists it (PBIs may add a skill to other runs). Pass a name to skill_get for its content.",
  input: z.object({}),
  async run(context) {
    const summaries = await context.skills.summaries?.();

    if (!summaries) {
      return { ok: false, error: "Skills can't be listed from here (the skill catalog has no summaries)." };
    }

    const agents = (await context.agents?.list()) ?? [];

    return { ok: true, value: summaries.map((skill) => withUsers(skill, agents)) };
  },
};

function withUsers(skill: SkillSummary, agents: AgentDefinition[]): SkillListEntry {
  const users = agents.filter((agent) => agent.skills.includes(skill.name)).map((agent) => ({ id: agent.id, label: agent.label }));

  return { ...skill, usedBy: users };
}
