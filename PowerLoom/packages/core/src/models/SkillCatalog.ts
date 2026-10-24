import type { SkillFile } from "./SkillFile";
import type { SkillSummary } from "./SkillSummary";

// The skills agents may load (the skill folders the caller can see). `summaries` and `read` serve the read commands
// (skill.list, skill.get); a caller without them gets an `ok: false` from those.
export interface SkillCatalog {
  names(): Promise<string[]>;
  summaries?(): Promise<SkillSummary[]>;
  /** The skill's SKILL.md, or null when no folder has it. */
  read?(name: string): Promise<SkillFile | null>;
}
