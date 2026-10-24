import type { Outcome } from "@powerloom/core";
import { attachment, type PowerLoomDb } from "@powerloom/db";
import { extractAttachmentText } from "./extractAttachmentText";
import type { AttachmentTarget } from "./models/AttachmentTarget";
import type { ExtractedFile } from "./models/ExtractedFile";
import type { UploadedFile } from "./models/UploadedFile";

// Converts and stores an upload; a file agents couldn't use is rejected with the reason and nothing is stored.
export async function storeAttachment(db: PowerLoomDb, file: UploadedFile, target: AttachmentTarget): Promise<Outcome<number>> {
  const stored = await storeAttachments(db, [file], target);

  return stored.ok ? { ok: true, value: stored.value[0] } : stored;
}

// Several uploads at once (user decision 2026-10-09): every file is converted first, and when one can't be used none is
// stored, so the user fixes the selection and sends it again. Returns the new ids in the files' order.
export async function storeAttachments(db: PowerLoomDb, files: UploadedFile[], target: AttachmentTarget): Promise<Outcome<number[]>> {
  const extracted = await extractAll(files);

  if (!extracted.ok) {
    return extracted;
  }

  const ids: number[] = [];

  for (const entry of extracted.value) {
    ids.push(await insertAttachment(db, entry, target));
  }

  return { ok: true, value: ids };
}

async function extractAll(files: UploadedFile[]): Promise<Outcome<ExtractedFile[]>> {
  const results = await Promise.all(files.map(async (file) => ({ file, extracted: await extractAttachmentText(file) })));
  const problems = results.flatMap((result) => (result.extracted.ok ? [] : [result.extracted.error]));

  if (problems.length > 0) {
    return { ok: false, error: [files.length > 1 ? "Nothing was uploaded." : "", ...problems].filter(Boolean).join(" ") };
  }

  return { ok: true, value: results.map((result) => ({ file: result.file, text: result.extracted.ok ? result.extracted.text : null })) };
}

async function insertAttachment(db: PowerLoomDb, entry: ExtractedFile, target: AttachmentTarget): Promise<number> {
  const [row] = await db
    .insert(attachment)
    .values({
      pbiId: target.adoId,
      itemId: target.itemId,
      sourceUrl: target.sourceUrl,
      origin: target.origin ?? "upload",
      sourceVersion: target.sourceVersion ?? null,
      fileName: entry.file.fileName,
      contentType: entry.file.contentType || "application/octet-stream",
      sizeBytes: entry.file.bytes.length,
      content: entry.file.bytes,
      text: entry.text,
    })
    .returning({ id: attachment.id });

  return row.id;
}
