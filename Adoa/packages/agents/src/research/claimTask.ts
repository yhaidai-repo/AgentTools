import { setPbiStatus } from "@adoa/core";
import { localItem, statusHistory, workItem, type AdoaDb } from "@adoa/db";
import { and, eq } from "drizzle-orm";

const ACTOR = "agent:research";

// Atomic claim of one task (open → in-progress); its PBI shows `researching` while any task is worked on.
export async function claimTask(db: AdoaDb, taskId: string, adoId: number): Promise<boolean> {
  const isClaimed = await db.transaction(async (tx) => {
    const claimed = await tx
      .update(localItem)
      .set({ status: "in-progress", updatedAt: new Date() })
      .where(and(eq(localItem.id, taskId), eq(localItem.status, "open")))
      .returning({ id: localItem.id });

    if (claimed.length === 0) {
      return false;
    }

    await tx.insert(statusHistory).values({ entityKind: "item", entityId: taskId, fromStatus: "open", toStatus: "in-progress", actor: ACTOR });

    return true;
  });

  if (isClaimed) {
    await markPbiResearching(db, adoId);
  }

  return isClaimed;
}

async function markPbiResearching(db: AdoaDb, adoId: number): Promise<void> {
  const [pbi] = await db.select({ status: workItem.pipelineStatus }).from(workItem).where(eq(workItem.adoId, adoId));

  if (pbi?.status === "needs-research") {
    await setPbiStatus(db, adoId, "needs-research", "researching", ACTOR);
  }
}
