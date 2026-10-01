import { vaultCapture, type AdoaDb } from "@adoa/db";
import { captureFileName, renderCaptureNote } from "@adoa/vault";
import { and, eq, isNull } from "drizzle-orm";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DRAFT_FOLDER = "draft";

type CaptureRow = typeof vaultCapture.$inferSelect;

// Writes the PBI's not-yet-written captures into the docs vault's draft/ folder (the only place the worker
// may write in the docs vault). Never overwrites: a name clash gets the capture id.
export async function writeCaptures(db: AdoaDb, draftRoot: string | undefined, adoId: number): Promise<void> {
  if (!draftRoot) {
    return;
  }

  const pending = await db.select().from(vaultCapture).where(and(eq(vaultCapture.pbiId, adoId), isNull(vaultCapture.filePath)));

  await mkdir(draftRoot, { recursive: true });

  for (const capture of pending) {
    await writeCapture(db, draftRoot, capture);
  }
}

async function writeCapture(db: AdoaDb, draftRoot: string, capture: CaptureRow): Promise<void> {
  const preferred = captureFileName(capture.project, capture.title, capture.id, false);
  const isTaken = await exists(join(draftRoot, preferred));
  const fileName = isTaken ? captureFileName(capture.project, capture.title, capture.id, true) : preferred;
  const source = `agent research RUN-${capture.runId} (${capture.itemId ?? "-"}, PBI-${capture.pbiId})`;
  const content = renderCaptureNote({ ...capture, source, created: capture.createdAt });

  await writeFile(join(draftRoot, fileName), content, { encoding: "utf8", flag: "wx" });
  await db.update(vaultCapture).set({ filePath: `${DRAFT_FOLDER}/${fileName}` }).where(eq(vaultCapture.id, capture.id));
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}
