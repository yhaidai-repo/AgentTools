import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillCatalog } from "../models/SkillCatalog";
import type { SkillSummary } from "../models/SkillSummary";
import { frontmatterField } from "./skillFrontmatter";

// Every skill (`<folder>/<name>/SKILL.md`) in the folders loadSkills searches, so a client can offer them as choices.
export async function listSkills(folders: string[]): Promise<SkillCatalog> {
  const catalog: SkillCatalog = { skills: [], missingFolders: [] };

  for (const folder of folders) {
    await addFolder(catalog, folder);
  }

  catalog.skills.sort((a, b) => a.name.localeCompare(b.name));

  return catalog;
}

async function addFolder(catalog: SkillCatalog, folder: string): Promise<void> {
  const names = await skillFolderNames(folder);

  if (names === null) {
    catalog.missingFolders.push(folder);

    return;
  }

  const known = new Set(catalog.skills.map((skill) => skill.name));
  const found = await Promise.all(names.filter((name) => !known.has(name)).map((name) => readSummary(folder, name)));

  catalog.skills.push(...found.filter((skill): skill is SkillSummary => skill !== null));
}

async function skillFolderNames(folder: string): Promise<string[] | null> {
  try {
    const entries = await readdir(folder, { withFileTypes: true });

    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return null;
  }
}

// A subfolder without SKILL.md isn't a skill.
async function readSummary(folder: string, name: string): Promise<SkillSummary | null> {
  const body = await readFile(join(folder, name, "SKILL.md"), "utf8").catch(() => null);

  return body === null ? null : { name, description: frontmatterField(body, "description") ?? "", folder };
}
