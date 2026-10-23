// A skill's SKILL.md as a caller reads it: only PowerLoom's own skills are editable from PowerLoom (user decision
// 2026-10-01); other folders are view-only.
export interface SkillFile {
  name: string;
  /** The folder's path as the caller sees it (inside the containers). */
  folder: string;
  editable: boolean;
  content: string;
}
