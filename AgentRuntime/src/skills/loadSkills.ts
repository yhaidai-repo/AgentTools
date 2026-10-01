import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillInfo } from "../models/SkillInfo";

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
  const body = await readFirst(candidates);

  if (body === null) {
    throw new Error(`Skill "${name}" not found in: ${folders.join(", ")}`);
  }

  return { name, description: frontmatterField(body, "description") ?? "", body };
}

async function readFirst(paths: string[]): Promise<string | null> {
  const results = await Promise.all(paths.map((path) => readFile(path, "utf8").catch(() => null)));

  return results.find((text) => text !== null) ?? null;
}

function frontmatterField(text: string, field: string): string | null {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const value = new RegExp(`^${field}:\\s*(.+)$`, "m").exec(frontmatter)?.[1];

  return value?.trim().replace(/^["']|["']$/g, "") ?? null;
}
