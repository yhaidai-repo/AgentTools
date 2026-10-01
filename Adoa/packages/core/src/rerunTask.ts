import { localItem, type AdoaDb } from "@adoa/db";
import { and, eq } from "drizzle-orm";
import { agentIdOf } from "./agentStages";
import type { Outcome } from "./models/Outcome";
import { setItemStatus } from "./pbiStatus";

const RERUNNABLE: string[] = ["done", "blocked"];

type ItemRow = typeof localItem.$inferSelect;

export function isRerunnableTask(item: ItemRow): boolean {
  return agentIdOf(item.assignee) !== null && item.kind !== "research-result" && RERUNNABLE.includes(item.status);
}

// "Re-run" on a finished agent task (user decision 2026-10-02): back to open with a fresh start (attempts, held reasons,
// hand-on reset); the dispatcher runs it on the agent's next dispatch or "Run now", after the usual checks.
export async function rerunTask(db: AdoaDb, adoId: number, itemId: string): Promise<Outcome<string>> {
  const [task] = await db.select().from(localItem).where(and(eq(localItem.id, itemId), eq(localItem.pbiId, adoId)));

  if (!task || !isRerunnableTask(task)) {
    return { ok: false, error: `${itemId} isn't a finished agent task of PBI-${adoId}.` };
  }

  await db.update(localItem).set({ attempts: 0, heldBy: [], handedOnAt: null }).where(eq(localItem.id, task.id));
  await setItemStatus(db, task.id, task.status, "open", "human");

  return { ok: true, value: task.id };
}
