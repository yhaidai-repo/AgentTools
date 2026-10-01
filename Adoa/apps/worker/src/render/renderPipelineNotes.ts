import { readAdoSettings } from "@adoa/core";
import { localItem, refinement, workItem, type AdoaDb } from "@adoa/db";
import { itemNotePath, refinementNotePath, renderItemNote, renderRefinementNote } from "@adoa/vault";
import { desc, eq } from "drizzle-orm";
import { PbiNoteWriter } from "./pbiNotes";

type ItemRow = typeof localItem.$inferSelect;

// Render job (queued by the agent-runner): refinement note, item notes, PBI note regions and the index.
export async function renderPipelineNotes(db: AdoaDb, adoId: number): Promise<void> {
  const [row] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));
  const ado = await readAdoSettings(db);

  if (!row || !ado) {
    return;
  }

  const notes = await PbiNoteWriter.create(db, ado);
  const pbiPath = await notes.writePbi(row, row.pipelineStatus);

  await writeRefinement(db, notes, pbiPath, adoId);
  await writeItems(db, notes, pbiPath, adoId);
  await notes.writeIndex();
}

async function writeRefinement(db: AdoaDb, notes: PbiNoteWriter, pbiPath: string, adoId: number): Promise<void> {
  const [latest] = await db.select().from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);

  if (!latest) {
    return;
  }

  await notes.writer.write(refinementNotePath(pbiPath, adoId), (notesSection) =>
    renderRefinementNote({ ...latest, adoId, created: latest.createdAt }, notesSection),
  );
}

async function writeItems(db: AdoaDb, notes: PbiNoteWriter, pbiPath: string, adoId: number): Promise<void> {
  const items = await db.select().from(localItem).where(eq(localItem.pbiId, adoId));

  for (const item of items) {
    await writeItem(db, notes, pbiPath, item);
  }
}

async function writeItem(db: AdoaDb, notes: PbiNoteWriter, pbiPath: string, item: ItemRow): Promise<void> {
  const path = item.vaultPath ?? itemNotePath(pbiPath, item.id, item.kind);

  await notes.writer.write(path, (notesSection) =>
    renderItemNote({
      id: item.id,
      kind: item.kind,
      adoId: item.pbiId,
      title: item.title,
      status: item.status,
      assignee: item.assignee,
      body: item.body,
      data: item.data as Record<string, unknown> | null,
      runId: item.createdByRun,
      created: item.createdAt,
      updated: item.updatedAt,
    }, notesSection),
  );
  await db.update(localItem).set({ vaultPath: path }).where(eq(localItem.id, item.id));
}
