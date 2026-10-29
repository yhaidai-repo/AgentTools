import type { ShippedSkill } from "./ShippedSkill";
import type { SkillFile } from "./SkillFile";
import type { SkillRevision } from "./SkillRevision";

// A skill as skill.get answers it: the file, its content's hash (a save passes it back so edits don't cross), the
// versions saves replaced, latest first, and for a skill PowerLoom ships how the last upgrade applied it.
export interface SkillDetail extends SkillFile {
  hash: string;
  revisions: SkillRevision[];
  shipped: ShippedSkill | null;
}
