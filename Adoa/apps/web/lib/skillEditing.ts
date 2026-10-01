import type { Outcome } from "@adoa/core";
import { skillRevision } from "@adoa/db";
import { readSkill, writeSkill, type SkillFile } from "@agenttools/runtime/skills";
import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { isEditableSkillFolder, skillFolders } from "./skills";

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

// Saves an existing skill. Refused when the file changed since the editor loaded it (`expectedHash`), so nobody's edit is
// lost; the version it replaces is kept as a revision first (user decision 2026-10-01).
export async function saveSkillContent(name: string, content: string, expectedHash: string): Promise<Outcome<void>> {
  const current = await loadSkillFile(name);

  if (!current) {
    return { ok: false, error: `No skill named ${name}; adoa only edits existing skills.` };
  }

  if (!isEditableSkillFolder(current.folder)) {
    return { ok: false, error: `${name} isn't one of adoa's own skills; edit it where it lives (adoa only views it).` };
  }

  if (contentHash(current.content) !== expectedHash) {
    return { ok: false, error: "The skill changed since you opened it. Reload the page and apply your edit again." };
  }

  if (current.content === content) {
    return { ok: true, value: undefined };
  }

  return replaceContent(current, content);
}

async function replaceContent(current: SkillFile, content: string): Promise<Outcome<void>> {
  const [revision] = await getDb().insert(skillRevision).values({ name: current.name, folder: current.folder, content: current.content }).returning({ id: skillRevision.id });
  const problem = await writeSkill(current, content);

  if (problem) {
    await getDb().delete(skillRevision).where(eq(skillRevision.id, revision.id));

    return { ok: false, error: problem };
  }

  return { ok: true, value: undefined };
}
