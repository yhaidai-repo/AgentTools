import { attachmentRef } from "@powerloom/core";
import { attachment, type PowerLoomDb } from "@powerloom/db";
import { attachmentFileName, attachmentPath, type VaultWriter } from "@powerloom/vault";
import { and, eq, isNull } from "drizzle-orm";
import type { VaultAttachment } from "./models/VaultAttachment";

// The PBI's uploads as the Vault names them (without the file bytes).
export async function listAttachments(db: PowerLoomDb, adoId: number): Promise<VaultAttachment[]> {
  const rows = await db
    .select({ id: attachment.id, fileName: attachment.fileName, itemId: attachment.itemId, sourceUrl: attachment.sourceUrl })
    .from(attachment)
    .where(eq(attachment.pbiId, adoId))
    .orderBy(attachment.id);

  return rows.map((row) => ({ ...row, ref: attachmentRef(row.id), vaultName: attachmentFileName(attachmentRef(row.id), row.fileName) }));
}

// Copies uploads not yet in the Vault into the PBI's attachments/ folder.
export async function writeAttachmentFiles(db: PowerLoomDb, writer: VaultWriter, pbiPath: string, adoId: number): Promise<void> {
  const pending = await db.select().from(attachment).where(and(eq(attachment.pbiId, adoId), isNull(attachment.vaultPath)));

  for (const row of pending) {
    const path = attachmentPath(pbiPath, attachmentRef(row.id), row.fileName);

    await writer.writeOnce(path, row.content);
    await db.update(attachment).set({ vaultPath: path }).where(eq(attachment.id, row.id));
  }
}
