import { workItem, statusHistory, type AdoaDb } from "@adoa/db";
import { and, eq } from "drizzle-orm";

const ACTOR = "agent:refinement";

// Atomic claim: only one runner can move a PBI from ready-for-refinement to refining.
export async function claimPbi(db: AdoaDb, adoId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .update(workItem)
      .set({ pipelineStatus: "refining" })
      .where(and(eq(workItem.adoId, adoId), eq(workItem.pipelineStatus, "ready-for-refinement")))
      .returning({ adoId: workItem.adoId });

    if (claimed.length === 0) {
      return false;
    }

    await tx.insert(statusHistory).values({ entityKind: "pbi", entityId: String(adoId), fromStatus: "ready-for-refinement", toStatus: "refining", actor: ACTOR });

    return true;
  });
}
