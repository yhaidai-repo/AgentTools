import { deletePbiData, readAdoSettings, vaultBacklogRoot } from "@adoa/core";
import { workItem } from "@adoa/db";
import { PbiNoteWriter } from "@adoa/notes";
import { VaultWriter } from "@adoa/vault";
import { eq } from "drizzle-orm";
import { dirname } from "node:path";
import type { WorkerContext } from "../models/WorkerContext";

// "Delete from adoa" on a PBI page: the data goes (see deletePbiData), then its folder in the backlog vault, and the
// backlog index is written without it.
export async function deletePbi(context: WorkerContext, adoId: number): Promise<string> {
  const [row] = await context.db.select({ vaultPath: workItem.vaultPath, vault: workItem.vault }).from(workItem).where(eq(workItem.adoId, adoId));
  const deleted = await deletePbiData(context.db, adoId);

  if (!deleted.ok) {
    throw new Error(deleted.error);
  }

  if (row?.vaultPath) {
    await new VaultWriter(vaultBacklogRoot(context.backlogMount, row.vault)).removeFolder(dirname(row.vaultPath));
    await rewriteIndex(context, row.vault);
  }

  return `PBI-${adoId} "${deleted.value}" deleted from adoa`;
}

async function rewriteIndex(context: WorkerContext, vault: string): Promise<void> {
  await (await PbiNoteWriter.create(context.db, await readAdoSettings(context.db, vault), vaultBacklogRoot(context.backlogMount, vault))).writeIndex();
}
