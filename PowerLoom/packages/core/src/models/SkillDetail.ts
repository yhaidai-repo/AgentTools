import type { SkillFile } from "./SkillFile";
import type { SkillRevision } from "./SkillRevision";

// A skill as skill.get answers it: the file, its content's hash (a save passes it back so edits don't cross) and the
// versions saves replaced, latest first.
export interface SkillDetail extends SkillFile {
  hash: string;
  revisions: SkillRevision[];
}
