import { attachment } from "@powerloom/db";
import { sql } from "drizzle-orm";

// Uploads without their bytes (downloads read those on their own).
export const ATTACHMENT_SUMMARY_COLUMNS = {
  id: attachment.id,
  itemId: attachment.itemId,
  sourceUrl: attachment.sourceUrl,
  origin: attachment.origin,
  sourceVersion: attachment.sourceVersion,
  fileName: attachment.fileName,
  sizeBytes: attachment.sizeBytes,
  textChars: sql<number | null>`length(${attachment.text})`,
  vaultPath: attachment.vaultPath,
  createdAt: attachment.createdAt,
};
