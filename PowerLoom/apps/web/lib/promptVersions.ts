import { agentPromptVersion } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";

export type PromptVersionRow = typeof agentPromptVersion.$inferSelect;

export async function loadPromptVersions(agentId: string): Promise<PromptVersionRow[]> {
  return getDb().select().from(agentPromptVersion).where(eq(agentPromptVersion.agentId, agentId)).orderBy(desc(agentPromptVersion.version));
}

// Every edit is a new version (user decision 2026-10-23); the number follows the agent's current one.
export async function insertPromptVersion(agentId: string, version: number, text: string): Promise<void> {
  await getDb().insert(agentPromptVersion).values({ agentId, version, text });
}
