import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillFile } from "../models/SkillFile";
import { frontmatterField } from "./skillFrontmatter";

// A skill name is a folder name; anything else (e.g. "../x") could leave the skill folders.
const SKILL_NAME = /^[a-z0-9][a-z0-9-]*$/;

// The SKILL.md loadSkills would use, or null when no folder has the skill (or the name isn't a skill name).
export async function readSkill(folders: string[], name: string): Promise<SkillFile | null> {
  if (!SKILL_NAME.test(name)) {
    return null;
  }

  const found = await Promise.all(folders.map((folder) => readFile(skillPath(folder, name), "utf8").then((content) => ({ folder, content }), () => null)));
  const first = found.find((entry) => entry !== null);

  return first ? { name, folder: first.folder, path: skillPath(first.folder, name), content: first.content } : null;
}

// Rewrites an existing skill only (no new skills, user decision 2026-10-01). Returns why it was refused, or null.
export async function writeSkill(file: SkillFile, content: string): Promise<string | null> {
  const problem = skillContentProblem(content);

  if (problem) {
    return problem;
  }

  await writeFile(file.path, content, "utf8");

  return null;
}

// Agents see a skill by its frontmatter description, so it must stay.
function skillContentProblem(content: string): string | null {
  if (!content.startsWith("---")) {
    return "SKILL.md must start with its frontmatter (---).";
  }

  return frontmatterField(content, "description") ? null : "The frontmatter needs a description: line; agents choose skills by it.";
}

function skillPath(folder: string, name: string): string {
  return join(folder, name, "SKILL.md");
}
