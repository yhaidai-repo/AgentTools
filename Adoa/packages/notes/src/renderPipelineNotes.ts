import { readAdoSettings } from "@adoa/core";
import { design, localItem, refinement, workItem, type AdoaDb } from "@adoa/db";
import { designNotePath, itemNotePath, refinementNotePath, renderDesignNote, renderItemNote, renderRefinementNote } from "@adoa/vault";
import { desc, eq } from "drizzle-orm";
import { listAttachments } from "./attachments";
import type { VaultAttachment } from "./models/VaultAttachment";
import { PbiNoteWriter } from "./pbiNotes";

type ItemRow = typeof localItem.$inferSelect;

// A PBI's notes from the DB: refinement note, design note, item notes, PBI note regions and the index (VaultWriter skips unchanged files).
export async function renderPipelineNotes(db: AdoaDb, vaultRoot: string, adoId: number): Promise<void> {
  const [row] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));
  const ado = await readAdoSettings(db);

  // A PBI gets its note only from "Prepare for refinement"; until then answers and uploads stay in the DB.
  if (!row?.vaultPath || !ado) {
    return;
  }

  const notes = await PbiNoteWriter.create(db, ado, vaultRoot);
  const pbiPath = await notes.writePbi(row, row.pipelineStatus);
  const attachments = await listAttachments(db, adoId);

  await writeRefinement(db, notes, pbiPath, adoId);
  await writeDesign(db, notes, pbiPath, adoId);
  await writeItems(db, notes, pbiPath, adoId, attachments);
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

async function writeDesign(db: AdoaDb, notes: PbiNoteWriter, pbiPath: string, adoId: number): Promise<void> {
  const [latest] = await db.select().from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1);

  if (!latest) {
    return;
  }

  await notes.writer.write(designNotePath(pbiPath, adoId), (notesSection) =>
    renderDesignNote({ ...latest, adoId, created: latest.createdAt }, notesSection),
  );
}

async function writeItems(db: AdoaDb, notes: PbiNoteWriter, pbiPath: string, adoId: number, attachments: VaultAttachment[]): Promise<void> {
  const items = await db.select().from(localItem).where(eq(localItem.pbiId, adoId));

  for (const item of items) {
    const files = attachments.filter((entry) => entry.itemId === item.id).map((entry) => entry.vaultName);

    await publishItem(db, notes, pbiPath, item, files);
  }
}

async function publishItem(db: AdoaDb, notes: PbiNoteWriter, pbiPath: string, item: ItemRow, attachments: string[]): Promise<void> {
  if (item.status === "deleted") {
    await removeItemNote(db, notes, item);

    return;
  }

  await writeItem(db, notes, pbiPath, item, attachments);
}

// A deleted item leaves the Vault: its note goes, and the PBI note's table no longer lists it.
async function removeItemNote(db: AdoaDb, notes: PbiNoteWriter, item: ItemRow): Promise<void> {
  if (!item.vaultPath) {
    return;
  }

  await notes.writer.remove(item.vaultPath);
  await db.update(localItem).set({ vaultPath: null }).where(eq(localItem.id, item.id));
}

async function writeItem(db: AdoaDb, notes: PbiNoteWriter, pbiPath: string, item: ItemRow, attachments: string[]): Promise<void> {
  const path = item.vaultPath ?? itemNotePath(pbiPath, item.id, item.kind);

  await notes.writer.write(path, (notesSection) =>
    renderItemNote({
      id: item.id,
      kind: item.kind,
      adoId: item.pbiId ?? 0,
      parentId: item.parentId,
      title: item.title,
      status: item.status,
      assignee: item.assignee,
      body: item.body,
      data: item.data as Record<string, unknown> | null,
      resolution: item.resolution,
      attachments,
      runId: item.createdByRun,
      created: item.createdAt,
      updated: item.updatedAt,
    }, notesSection),
  );
  await db.update(localItem).set({ vaultPath: path }).where(eq(localItem.id, item.id));
}
