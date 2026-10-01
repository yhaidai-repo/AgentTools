import { localItem, statusHistory, workItem, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
import type { ItemStatus } from "./models/ItemStatus";
import type { PipelineStatus } from "./models/PipelineStatus";

// Every pipeline status change goes through here so status_history stays complete.
export async function setPbiStatus(
  db: AdoaDb,
  adoId: number,
  from: PipelineStatus | null,
  to: PipelineStatus,
  actor: string,
  runId?: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(workItem).set({ pipelineStatus: to }).where(eq(workItem.adoId, adoId));
    await tx.insert(statusHistory).values({
      entityKind: "pbi",
      entityId: String(adoId),
      fromStatus: from,
      toStatus: to,
      actor,
      runId,
    });
  });
}

// Same for local items (tasks, questions): every status change lands in status_history.
export async function setItemStatus(db: AdoaDb, itemId: string, from: string | null, to: ItemStatus, actor: string, runId?: number): Promise<void> {
  const closedAt = CLOSED_ITEM_STATUSES.includes(to) ? new Date() : null;

  await db.transaction(async (tx) => {
    await tx.update(localItem).set({ status: to, updatedAt: new Date(), closedAt }).where(eq(localItem.id, itemId));
    await tx.insert(statusHistory).values({ entityKind: "item", entityId: itemId, fromStatus: from, toStatus: to, actor, runId });
  });
}

const CLOSED_ITEM_STATUSES: ItemStatus[] = ["done", "cancelled", "answered", "dismissed"];
