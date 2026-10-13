import { localItem, statusHistory, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { ItemStatus } from "./models/ItemStatus";

// Every status change of a local item (tasks, questions) goes through here so status_history stays complete; the
// backend owns the PBI's status (PbiStatusSync).
export async function setItemStatus(db: PowerLoomDb, itemId: string, from: string | null, to: ItemStatus, actor: string, runId?: number): Promise<void> {
  const closedAt = CLOSED_ITEM_STATUSES.includes(to) ? new Date() : null;

  await db.transaction(async (tx) => {
    await tx.update(localItem).set({ status: to, updatedAt: new Date(), closedAt }).where(eq(localItem.id, itemId));
    await tx.insert(statusHistory).values({ entityKind: "item", entityId: itemId, fromStatus: from, toStatus: to, actor, runId });
  });
}

const CLOSED_ITEM_STATUSES: ItemStatus[] = ["done", "cancelled", "answered", "dismissed", "deleted"];
