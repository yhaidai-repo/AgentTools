import { agentPromptVersion, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import type { AgentWorkPort } from "../models/AgentWorkPort";
import type { Outcome } from "../models/Outcome";

export type PromptVersionRow = typeof agentPromptVersion.$inferSelect;

export async function loadPromptVersions(db: PowerLoomDb, agentId: string): Promise<PromptVersionRow[]> {
  return db.select().from(agentPromptVersion).where(eq(agentPromptVersion.agentId, agentId)).orderBy(desc(agentPromptVersion.version));
}

// History can outlive a failed definition save. Reuse an identical orphaned version, or reserve a newer
// version through PowerLoom's API. Reads stay local; every history write stays behind the API's unique key.
export async function reservePromptVersion(db: PowerLoomDb, work: AgentWorkPort, agentId: string, currentVersion: number, text: string): Promise<Outcome<number>> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const [latest] = await db.select().from(agentPromptVersion).where(eq(agentPromptVersion.agentId, agentId)).orderBy(desc(agentPromptVersion.version)).limit(1);
    if (latest && latest.version > currentVersion && latest.text === text) return { ok: true, value: latest.version };
    const version = Math.max(currentVersion, latest?.version ?? 0) + 1;
    const saved = await work.addPromptVersion(agentId, version, text);
    if (saved.ok) return saved;
    const [after] = await db.select().from(agentPromptVersion).where(eq(agentPromptVersion.agentId, agentId)).orderBy(desc(agentPromptVersion.version)).limit(1);
    if (!after || after.version < version) return saved;
  }
  return { ok: false, error: "Prompt history changed repeatedly; read the agent again and retry." };
}
