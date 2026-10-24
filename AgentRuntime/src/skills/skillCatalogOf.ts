import type { SkillSummary } from "../models/SkillSummary";
import { listSkills } from "./listSkills";
import { readSkill } from "./skillFiles";

// What a host answers about its skill folders: the names agents may load, every skill's summary, and one skill's
// SKILL.md with whether the host may edit it (only its own folder, user decision 2026-10-01). Shaped for PowerLoom's
// SkillCatalog (its skill.list and skill.get commands) without depending on it.
export interface HostSkillCatalog {
  names(): Promise<string[]>;
  summaries(): Promise<SkillSummary[]>;
  read(name: string): Promise<{ name: string; folder: string; editable: boolean; content: string } | null>;
}

export function skillCatalogOf(folders: string[], editableFolder: string | null): HostSkillCatalog {
  return {
    names: async () => (await listSkills(folders)).skills.map((skill) => skill.name),
    summaries: async () => (await listSkills(folders)).skills,
    read: async (name) => {
      const file = await readSkill(folders, name);

      return file ? { name: file.name, folder: file.folder, editable: file.folder === editableFolder, content: file.content } : null;
    },
  };
}
