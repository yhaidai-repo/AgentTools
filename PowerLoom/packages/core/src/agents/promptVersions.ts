import { agentPromptVersion, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";

export type PromptVersionRow = typeof agentPromptVersion.$inferSelect;

export async function loadPromptVersions(db: PowerLoomDb, agentId: string): Promise<PromptVersionRow[]> {
  return db.select().from(agentPromptVersion).where(eq(agentPromptVersion.agentId, agentId)).orderBy(desc(agentPromptVersion.version));
}

// Every edit is a new version (user decision 2026-10-23); the number follows the agent's current one.
export async function insertPromptVersion(db: PowerLoomDb, agentId: string, version: number, text: string): Promise<void> {
  await db.insert(agentPromptVersion).values({ agentId, version, text });
}

// History can outlive a failed definition save. Reuse an identical orphaned version, or reserve a newer
// version with the unique key as the concurrency guard. Never overwrite another edit's history.
export async function reservePromptVersion(db: PowerLoomDb, agentId: string, currentVersion: number, text: string): Promise<number> {
  for (;;) {
    const [latest] = await db.select().from(agentPromptVersion).where(eq(agentPromptVersion.agentId, agentId)).orderBy(desc(agentPromptVersion.version)).limit(1);
    if (latest && latest.version > currentVersion && latest.text === text) return latest.version;
    const version = Math.max(currentVersion, latest?.version ?? 0) + 1;
    const inserted = await db.insert(agentPromptVersion).values({ agentId, version, text }).onConflictDoNothing().returning({ version: agentPromptVersion.version });
    if (inserted.length > 0) return version;
  }
}

// A deleted agent takes its prompt history with it.
export async function deletePromptVersions(db: PowerLoomDb, agentId: string): Promise<void> {
  await db.delete(agentPromptVersion).where(eq(agentPromptVersion.agentId, agentId));
}
