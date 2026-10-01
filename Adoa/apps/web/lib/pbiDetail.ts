import { agentRun, attachment, localItem, refinement, vaultCapture, workItem } from "@adoa/db";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./db";

// Uploads without their bytes (downloads read those on their own).
const ATTACHMENT_SUMMARY = {
  id: attachment.id,
  itemId: attachment.itemId,
  sourceUrl: attachment.sourceUrl,
  fileName: attachment.fileName,
  sizeBytes: attachment.sizeBytes,
  textChars: sql<number | null>`length(${attachment.text})`,
  vaultPath: attachment.vaultPath,
  createdAt: attachment.createdAt,
};

// Everything the PBI page shows.
export async function loadPbiDetail(adoId: number) {
  const db = getDb();
  const [pbi] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));

  if (!pbi) {
    return null;
  }

  // Items the user deleted stay in the DB (so agents don't recreate them) but aren't shown.
  const items = await db.select().from(localItem).where(and(eq(localItem.pbiId, adoId), ne(localItem.status, "deleted"))).orderBy(localItem.id);
  const attachments = await db.select(ATTACHMENT_SUMMARY).from(attachment).where(eq(attachment.pbiId, adoId)).orderBy(attachment.id);
  const runs = await db.select().from(agentRun).where(eq(agentRun.pbiId, adoId)).orderBy(desc(agentRun.id));
  const [latestRefinement] = await db.select().from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);
  const drafts = await db.select().from(vaultCapture).where(eq(vaultCapture.pbiId, adoId)).orderBy(vaultCapture.id);

  return { pbi, items, attachments, runs, drafts, refinement: latestRefinement ?? null };
}

// One item with its uploads and, for a task, its results (shown inside the task).
export async function loadItemDetail(adoId: number, itemId: string) {
  const db = getDb();
  const [item] = await db.select().from(localItem).where(and(eq(localItem.id, itemId), eq(localItem.pbiId, adoId)));

  if (!item) {
    return null;
  }

  const attachments = await db.select(ATTACHMENT_SUMMARY).from(attachment).where(eq(attachment.itemId, itemId)).orderBy(attachment.id);
  const results = await db.select().from(localItem).where(and(eq(localItem.parentId, itemId), eq(localItem.kind, "research-result"))).orderBy(localItem.id);

  return { item, attachments, results };
}

export type PbiDetail = NonNullable<Awaited<ReturnType<typeof loadPbiDetail>>>;
export type ItemDetail = NonNullable<Awaited<ReturnType<typeof loadItemDetail>>>;
export type ItemRow = PbiDetail["items"][number];
