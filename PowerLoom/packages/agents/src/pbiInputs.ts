import { attachmentRef } from "@powerloom/core";
import { attachment, localItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AttachmentSummary } from "./models/AttachmentSummary";
import type { ExistingItem } from "./models/ExistingItem";
import type { PbiInputs } from "./models/PbiInputs";

const LISTED_KINDS = ["question", "human", "research"] as const;

export async function loadPbiInputs(db: PowerLoomDb, adoId: number): Promise<PbiInputs> {
  const attachments = await loadAttachments(db, adoId);

  return { attachments, items: await loadItems(db, adoId, attachments) };
}

export function attachmentsBlock(attachments: AttachmentSummary[]): string {
  if (attachments.length === 0) {
    return "<attachments>none</attachments>";
  }

  const lines = attachments.map((entry) => `- ${entry.id} ${entry.fileName}${describe(entry)}`);

  return ["<attachments>", "Uploaded by the user. Read them with read_attachment.", ...lines, "</attachments>"].join("\n");
}

// Every question and task the PBI has, so a rerun or a later agent never asks or creates the same again
// (user decision 2026-10-01); the tools also reject near-identical text.
export function itemsBlock(items: ExistingItem[]): string {
  if (items.length === 0) {
    return "<existing-items>none</existing-items>";
  }

  const header = "Questions and tasks this PBI already has. Never create one of these again, also not reworded: refer to its id. Answers are the team's decisions.";

  return ["<existing-items>", header, ...items.map(itemLine), "</existing-items>"].join("\n");
}

function itemLine(item: ExistingItem): string {
  const files = item.attachmentIds.length > 0 ? ` (see ${item.attachmentIds.join(", ")})` : "";
  const answer = item.resolution || files ? `\n  Answer: ${item.resolution ?? "-"}${files}` : "";
  const status = item.status === "deleted" ? "deleted by the user: never create it again" : item.status;

  return `- ${item.id} (${item.kind}, ${status}): ${item.text}${answer}`;
}

async function loadAttachments(db: PowerLoomDb, adoId: number): Promise<AttachmentSummary[]> {
  const rows = await db
    .select({ id: attachment.id, fileName: attachment.fileName, sourceUrl: attachment.sourceUrl, itemId: attachment.itemId, textChars: sql<number | null>`length(${attachment.text})` })
    .from(attachment)
    .where(eq(attachment.pbiId, adoId))
    .orderBy(attachment.id);

  return rows.map((row) => ({ ...row, id: attachmentRef(row.id) }));
}

async function loadItems(db: PowerLoomDb, adoId: number, attachments: AttachmentSummary[]): Promise<ExistingItem[]> {
  const rows = await db
    .select()
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), inArray(localItem.kind, [...LISTED_KINDS])))
    .orderBy(localItem.id);

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    text: row.body ?? row.title,
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
