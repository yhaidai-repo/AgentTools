import { attachmentRef } from "@adoa/core";
import { attachment, localItem, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AttachmentSummary } from "./models/AttachmentSummary";
import type { ClosedHumanItem } from "./models/ClosedHumanItem";
import type { PbiInputs } from "./models/PbiInputs";

const CLOSED_HUMAN_STATUSES = ["answered", "dismissed", "done", "cancelled"] as const;

export async function loadPbiInputs(db: AdoaDb, adoId: number): Promise<PbiInputs> {
  const attachments = await loadAttachments(db, adoId);

  return { attachments, closedItems: await loadClosedItems(db, adoId, attachments) };
}

export function attachmentsBlock(attachments: AttachmentSummary[]): string {
  if (attachments.length === 0) {
    return "<attachments>none</attachments>";
  }

  const lines = attachments.map((entry) => `- ${entry.id} ${entry.fileName}${describe(entry)}`);

  return ["<attachments>", "Uploaded by the user. Read them with read_attachment.", ...lines, "</attachments>"].join("\n");
}

export function answersBlock(items: ClosedHumanItem[]): string {
  if (items.length === 0) {
    return "<answers>none</answers>";
  }

  return ["<answers>", "Questions and human tasks the user closed.", ...items.map(answerLine), "</answers>"].join("\n");
}

function answerLine(item: ClosedHumanItem): string {
  const files = item.attachmentIds.length > 0 ? ` (see ${item.attachmentIds.join(", ")})` : "";

  return `- ${item.id} (${item.kind}, ${item.status}): ${item.title}\n  Answer: ${item.resolution ?? "-"}${files}`;
}

async function loadAttachments(db: AdoaDb, adoId: number): Promise<AttachmentSummary[]> {
  const rows = await db
    .select({ id: attachment.id, fileName: attachment.fileName, sourceUrl: attachment.sourceUrl, itemId: attachment.itemId, textChars: sql<number | null>`length(${attachment.text})` })
    .from(attachment)
    .where(eq(attachment.pbiId, adoId))
    .orderBy(attachment.id);

  return rows.map((row) => ({ ...row, id: attachmentRef(row.id) }));
}

async function loadClosedItems(db: AdoaDb, adoId: number, attachments: AttachmentSummary[]): Promise<ClosedHumanItem[]> {
  const rows = await db
    .select()
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), eq(localItem.assignee, "human"), inArray(localItem.status, [...CLOSED_HUMAN_STATUSES])))
    .orderBy(localItem.id);

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    resolution: row.resolution,
    attachmentIds: attachments.filter((entry) => entry.itemId === row.id).map((entry) => entry.id),
  }));
}

function describe(entry: AttachmentSummary): string {
  const parts = [
    entry.sourceUrl ? `content of ${entry.sourceUrl}` : null,
    entry.itemId ? `for ${entry.itemId}` : null,
    entry.textChars === null ? "no text (image)" : `${entry.textChars} chars`,
  ];

  return ` (${parts.filter(Boolean).join("; ")})`;
}
