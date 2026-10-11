import { workItem, type AdoaDb, type PbiSkill } from "@adoa/db";
import { and, eq, isNull } from "drizzle-orm";

// Each PBI skill adds its description to every later agent's prompt on the PBI (user decision 2026-10-01: at most 5).
export const MAX_PBI_SKILLS = 5;

const ADOA_SKILL_PREFIX = "adoa-";

// adoa's own skills are configured per agent, so they're never recommended per PBI (assumption: the prefix marks them).
export function isRecommendableSkill(name: string): boolean {
  return !name.startsWith(ADOA_SKILL_PREFIX);
}

// What's wrong with a PBI skill list, checked against the skills the folders have (empty = fine).
export function pbiSkillProblems(names: string[], available: string[]): string[] {
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  const problems = [
    names.length > MAX_PBI_SKILLS ? `at most ${MAX_PBI_SKILLS} skills` : null,
    duplicates.length > 0 ? `listed twice: ${duplicates.join(", ")}` : null,
    ...names.filter((name) => !isRecommendableSkill(name)).map((name) => `${name} is configured per agent, not per PBI`),
    ...names.filter((name) => isRecommendableSkill(name) && !available.includes(name)).map((name) => `no skill named ${name}`),
  ];

  return problems.filter((problem): problem is string => problem !== null);
}

// Refinement's recommendation replaces the list only until the user saved one.
export async function recommendPbiSkills(db: AdoaDb, adoId: number, skills: { name: string; reason: string }[]): Promise<boolean> {
  const list: PbiSkill[] = skills.map((skill) => ({ ...skill, by: "agent" }));
  const updated = await db
    .update(workItem)
    .set({ skills: list })
    .where(and(eq(workItem.adoId, adoId), isNull(workItem.skillsEditedAt)))
    .returning({ adoId: workItem.adoId });

  return updated.length > 0;
}
