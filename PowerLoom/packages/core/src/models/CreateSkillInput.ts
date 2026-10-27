// What skill.create takes: the folder name, the line agents choose the skill by, and the SKILL.md body.
export interface CreateSkillInput {
  name: string;
  description: string;
  body: string;
  /** Retry a combined form operation only when the editable skill content is identical. */
  reuseIfUnchanged?: boolean;
}
