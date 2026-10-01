import { ensureAgentTask, readAdoSettings, setPbiStatus, type PipelineStatus } from "@adoa/core";
import { workItem } from "@adoa/db";
import { PbiNoteWriter } from "@adoa/notes";
import { eq } from "drizzle-orm";
import type { WorkerContext } from "../models/WorkerContext";
import { refreshPbi } from "../refreshPbi";

// Statuses sync sets that the pipeline can't derive from tasks; prepare takes the PBI out of them.
const NOT_IN_PIPELINE: PipelineStatus[] = ["new", "stale"];

// Manual step (user selects PBIs): writes the note from the Vault template and queues a refinement task, also for a PBI
// already in the pipeline (a re-refinement). Returns how many refinement tasks were queued.
export async function preparePbis(context: WorkerContext, adoIds: number[]): Promise<number> {
  const ado = await readAdoSettings(context.db);

  if (!ado) {
    throw new Error("ADO settings are not configured");
  }

  const notes = await PbiNoteWriter.create(context.db, ado, context.vaultRoot);
  let queued = 0;

  for (const adoId of adoIds) {
    const isQueued = await prepareOne(context, notes, adoId);

    queued += isQueued ? 1 : 0;
  }

  await notes.writeIndex();

  return queued;
}

// False when the PBI is unknown or already has an open refinement task.
async function prepareOne(context: WorkerContext, notes: PbiNoteWriter, adoId: number): Promise<boolean> {
  const [row] = await context.db.select().from(workItem).where(eq(workItem.adoId, adoId));

  if (!row) {
    return false;
  }

  const status = NOT_IN_PIPELINE.includes(row.pipelineStatus) ? "ready-for-refinement" : row.pipelineStatus;

  await notes.writePbi(row, status);

  if (status !== row.pipelineStatus) {
    await setPbiStatus(context.db, adoId, row.pipelineStatus, status, "human");
  }

  const taskId = await ensureAgentTask(context.db, "refinement", adoId, null);

  // Linked documents become attachments or human tasks now; the status then follows the new task.
  await refreshPbi(context, adoId);

  return taskId !== null;
}
