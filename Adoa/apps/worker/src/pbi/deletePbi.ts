import { deletePbiData, readAdoSettings } from "@adoa/core";
import { workItem } from "@adoa/db";
import { PbiNoteWriter } from "@adoa/notes";
import { VaultWriter } from "@adoa/vault";
import { eq } from "drizzle-orm";
import { dirname } from "node:path";
import type { WorkerContext } from "../models/WorkerContext";

// "Delete from adoa" on a PBI page: the data goes (see deletePbiData), then its folder in the backlog vault, and the
// backlog index is written without it.
export async function deletePbi(context: WorkerContext, adoId: number): Promise<string> {
  const [row] = await context.db.select({ vaultPath: workItem.vaultPath }).from(workItem).where(eq(workItem.adoId, adoId));
  const deleted = await deletePbiData(context.db, adoId);

  if (!deleted.ok) {
    throw new Error(deleted.error);
  }

  if (row?.vaultPath) {
    await new VaultWriter(context.vaultRoot).removeFolder(dirname(row.vaultPath));
    await rewriteIndex(context);
  }

  return `PBI-${adoId} "${deleted.value}" deleted from adoa`;
}

async function rewriteIndex(context: WorkerContext): Promise<void> {
  const ado = await readAdoSettings(context.db);

  if (ado) {
    await (await PbiNoteWriter.create(context.db, ado, context.vaultRoot)).writeIndex();
  }
}
