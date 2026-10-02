import type { Outcome } from "@adoa/core";
import { attachment, type AdoaDb } from "@adoa/db";
import { extractAttachmentText } from "./extractAttachmentText";
import type { AttachmentTarget } from "./models/AttachmentTarget";
import type { UploadedFile } from "./models/UploadedFile";

// Converts and stores an upload; a file agents couldn't use is rejected with the reason and nothing is stored.
export async function storeAttachment(db: AdoaDb, file: UploadedFile, target: AttachmentTarget): Promise<Outcome<number>> {
  const extracted = await extractAttachmentText(file);

  if (!extracted.ok) {
    return extracted;
  }

  const [row] = await db
    .insert(attachment)
    .values({
      pbiId: target.adoId,
      itemId: target.itemId,
      sourceUrl: target.sourceUrl,
      origin: target.origin ?? "upload",
      sourceVersion: target.sourceVersion ?? null,
      fileName: file.fileName,
      contentType: file.contentType || "application/octet-stream",
      sizeBytes: file.bytes.length,
      content: file.bytes,
      text: extracted.text,
    })
    .returning({ id: attachment.id });

  return { ok: true, value: row.id };
}
