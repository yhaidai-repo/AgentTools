import type { SkillSummary } from "./SkillSummary";

export interface SkillCatalog {
  /** One entry per name; when two folders have the same skill, the earlier folder wins (as in loadSkills). */
  skills: SkillSummary[];
  /** Configured folders that don't exist or can't be read. */
  missingFolders: string[];
}
