import { ensureAgentTask, readAdoSettings, setPbiStatus, type PipelineStatus } from "@adoa/core";
import { workItem } from "@adoa/db";
import { PbiNoteWriter } from "@adoa/notes";
import { eq } from "drizzle-orm";
import type { WorkerContext } from "../models/WorkerContext";
import { refreshPbi } from "../refreshPbi";

const PREPARABLE: PipelineStatus[] = ["new", "stale"];

// Manual step (user selects PBIs): creates the note from the Vault template and a refinement task for the dispatcher.
export async function preparePbis(context: WorkerContext, adoIds: number[]): Promise<number> {
  const ado = await readAdoSettings(context.db);

  if (!ado) {
    throw new Error("ADO settings are not configured");
  }

  const notes = await PbiNoteWriter.create(context.db, ado, context.vaultRoot);
  let prepared = 0;

  for (const adoId of adoIds) {
    const isPrepared = await prepareOne(context, notes, adoId);

    prepared += isPrepared ? 1 : 0;
  }

  await notes.writeIndex();

  return prepared;
}

async function prepareOne(context: WorkerContext, notes: PbiNoteWriter, adoId: number): Promise<boolean> {
  const [row] = await context.db.select().from(workItem).where(eq(workItem.adoId, adoId));

  if (!row) {
    return false;
  }

  const status = PREPARABLE.includes(row.pipelineStatus) ? "ready-for-refinement" : row.pipelineStatus;

  await notes.writePbi(row, status);

  if (status !== row.pipelineStatus) {
    await setPbiStatus(context.db, adoId, row.pipelineStatus, status, "human");
    await ensureAgentTask(context.db, "refinement", adoId, null);
  }

  // Linked documents become attachments or human tasks now, so refinement doesn't start without them.
  await refreshPbi(context, adoId);

  return true;
}
