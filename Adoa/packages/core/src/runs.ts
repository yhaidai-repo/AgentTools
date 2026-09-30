import { agentRun, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
import type { RunOutcome } from "./models/RunOutcome";
import type { Stage } from "./models/Stage";

export async function startRun(db: AdoaDb, stage: Stage): Promise<number> {
  const [row] = await db.insert(agentRun).values({ stage }).returning({ id: agentRun.id });

  return row.id;
}

export async function finishRun(db: AdoaDb, runId: number, outcome: RunOutcome, error: string | null): Promise<void> {
  await db.update(agentRun).set({ outcome, error, endedAt: new Date() }).where(eq(agentRun.id, runId));
}
