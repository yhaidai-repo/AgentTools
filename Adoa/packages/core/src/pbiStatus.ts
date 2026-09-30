import { statusHistory, workItem, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
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
