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

// A deleted agent takes its prompt history with it.
export async function deletePromptVersions(db: PowerLoomDb, agentId: string): Promise<void> {
  await db.delete(agentPromptVersion).where(eq(agentPromptVersion.agentId, agentId));
}
