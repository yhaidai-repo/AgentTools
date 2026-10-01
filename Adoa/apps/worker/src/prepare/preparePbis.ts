import { readAdoSettings, setPbiStatus, type PipelineStatus } from "@adoa/core";
import { workItem, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
import { PbiNoteWriter } from "../render/pbiNotes";

const PREPARABLE: PipelineStatus[] = ["new", "stale"];

// Manual step (user selects PBIs): creates the note from the Vault template and hands the PBI to refinement.
export async function preparePbis(db: AdoaDb, adoIds: number[]): Promise<number> {
  const ado = await readAdoSettings(db);

  if (!ado) {
    throw new Error("ADO settings are not configured");
  }

  const notes = await PbiNoteWriter.create(db, ado);
  let prepared = 0;

  for (const adoId of adoIds) {
    const isPrepared = await prepareOne(db, notes, adoId);

    prepared += isPrepared ? 1 : 0;
  }

  await notes.writeIndex();

  return prepared;
}

async function prepareOne(db: AdoaDb, notes: PbiNoteWriter, adoId: number): Promise<boolean> {
  const [row] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));

  if (!row) {
    return false;
  }

  const status = PREPARABLE.includes(row.pipelineStatus) ? "ready-for-refinement" : row.pipelineStatus;

  await notes.writePbi(row, status);

  if (status !== row.pipelineStatus) {
    await setPbiStatus(db, adoId, row.pipelineStatus, status, "human");
  }

  return true;
}
