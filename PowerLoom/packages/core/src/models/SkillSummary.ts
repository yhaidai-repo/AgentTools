// One skill a caller's skill folders hold: its name, the description agents choose it by, and the folder it was read from.
export interface SkillSummary {
  name: string;
  description: string;
  /** The folder's path as the caller sees it (inside the containers). */
  folder: string;
}
