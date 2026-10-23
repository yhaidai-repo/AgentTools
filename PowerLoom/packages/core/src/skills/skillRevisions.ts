import { skillRevision, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import type { SkillRevision } from "../models/SkillRevision";

const SHOWN_REVISIONS = 20;

// The versions saves replaced, latest first; the skill's page and skill.get show the same 20.
export function loadRevisions(db: PowerLoomDb, name: string): Promise<SkillRevision[]> {
  return db.select({ id: skillRevision.id, savedAt: skillRevision.savedAt, content: skillRevision.content }).from(skillRevision).where(eq(skillRevision.name, name)).orderBy(desc(skillRevision.savedAt)).limit(SHOWN_REVISIONS);
}
