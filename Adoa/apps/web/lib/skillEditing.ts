import { skillRevision } from "@adoa/db";
import { readSkill, type SkillFile } from "@agenttools/runtime/skills";
import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { skillFolders } from "./skills";

const SHOWN_REVISIONS = 20;

export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function loadSkillFile(name: string): Promise<SkillFile | null> {
  return readSkill(skillFolders().map((folder) => folder.path), name);
}

export function loadRevisions(name: string) {
  return getDb().select().from(skillRevision).where(eq(skillRevision.name, name)).orderBy(desc(skillRevision.savedAt)).limit(SHOWN_REVISIONS);
}
