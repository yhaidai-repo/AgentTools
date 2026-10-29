import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillInfo } from "../models/SkillInfo";
import { frontmatterField } from "./skillFrontmatter";
import { skillReferences } from "./skillReferences";

// Loads the allowed skills (`<dir>/<name>/SKILL.md`); the first folder that has a skill wins.
export async function loadSkills(folders: string[], allowedNames: string[]): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];

  for (const name of allowedNames) {
    skills.push(await loadSkill(folders, name));
  }

  return skills;
}

async function loadSkill(folders: string[], name: string): Promise<SkillInfo> {
  const candidates = folders.map((folder) => join(folder, name, "SKILL.md"));
  const found = await readFirst(candidates);

  if (found === null) {
    throw new Error(`Skill "${name}" not found in: ${folders.join(", ")}`);
  }

  const { body, path } = found;
  const references = await skillReferences(path, body);
  return { name, description: frontmatterField(body, "description") ?? "", body, supportingFiles: references.files, unavailableSupportingFiles: references.unavailable };
}

async function readFirst(paths: string[]): Promise<{ path: string; body: string } | null> {
  const results = await Promise.all(paths.map((path) => readFile(path, "utf8").then(body => ({ path, body }), () => null)));

  return results.find((text) => text !== null) ?? null;
}
