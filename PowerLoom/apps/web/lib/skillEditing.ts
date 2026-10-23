import { loadRevisions as loadRevisionsOf, type SkillRevision } from "@powerloom/core";
import { readSkill, type SkillFile } from "@agenttools/runtime/skills";
import { getDb } from "./db";
import { skillFolders } from "./skills";

// The hash a save passes back lives in core's skills domain, shared with skill.get.
export { contentHash } from "@powerloom/core";

export function loadSkillFile(name: string): Promise<SkillFile | null> {
  return readSkill(skillFolders().map((folder) => folder.path), name);
}

// The versions saves replaced (core's loadRevisions with the web's database).
export function loadRevisions(name: string): Promise<SkillRevision[]> {
  return loadRevisionsOf(getDb(), name);
}
