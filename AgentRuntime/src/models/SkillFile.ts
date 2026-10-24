// One skill's SKILL.md as found on disk (the first folder that has the skill, as loadSkills picks it).
export interface SkillFile {
  name: string;
  folder: string;
  path: string;
  content: string;
}
