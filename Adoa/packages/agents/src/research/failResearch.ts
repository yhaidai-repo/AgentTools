import { setItemStatus } from "@adoa/core";
import { localItem, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
import { moveResearchedPbi } from "./commitResearch";

const ACTOR = "agent:research";

// Failed run: the task goes back to open for a retry, or to blocked after `maxFailures` attempts.
export async function failResearch(db: AdoaDb, taskId: string, adoId: number, attempts: number, maxFailures: number, runId: number): Promise<void> {
  const nextAttempts = attempts + 1;
  const status = nextAttempts >= maxFailures ? "blocked" : "open";

  await db.update(localItem).set({ attempts: nextAttempts }).where(eq(localItem.id, taskId));
  await setItemStatus(db, taskId, "in-progress", status, ACTOR, runId);
  await moveResearchedPbi(db, adoId, runId);
}
