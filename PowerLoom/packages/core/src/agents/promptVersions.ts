import { agentPromptVersion, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";

export type PromptVersionRow = typeof agentPromptVersion.$inferSelect;

export async function loadPromptVersions(db: PowerLoomDb, agentId: string): Promise<PromptVersionRow[]> {
  return db.select().from(agentPromptVersion).where(eq(agentPromptVersion.agentId, agentId)).orderBy(desc(agentPromptVersion.version));
}
