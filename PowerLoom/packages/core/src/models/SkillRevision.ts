// A SKILL.md as it was before a save replaced it (the skill_revision table), for the skill's page and skill.get.
export interface SkillRevision {
  id: number;
  savedAt: Date;
  content: string;
}
