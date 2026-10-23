import { agentRun, attachment, localItem, type PowerLoomDb } from "@powerloom/db";
import { and, desc, eq, ne } from "drizzle-orm";
import { ATTACHMENT_SUMMARY_COLUMNS } from "./attachmentColumns";

// One item with its uploads, its runs and the findings it raised; its versioned results load where they are shown. The
// route checks the item belongs to its URL (a PBI's page, or Tasks for items without one).
export async function loadItemDetail(db: PowerLoomDb, itemId: string) {
  const [item] = await db.select().from(localItem).where(eq(localItem.id, itemId));

  if (!item) {
    return null;
  }

  const attachments = await db.select(ATTACHMENT_SUMMARY_COLUMNS).from(attachment).where(eq(attachment.itemId, itemId)).orderBy(attachment.id);
  const findings = await db.select().from(localItem).where(and(eq(localItem.parentId, itemId), eq(localItem.kind, "finding"), ne(localItem.status, "deleted"))).orderBy(localItem.id);
  const runs = await db.select({ id: agentRun.id, stage: agentRun.stage, itemId: agentRun.itemId, startedAt: agentRun.startedAt, outcome: agentRun.outcome, outputs: agentRun.outputs }).from(agentRun).where(eq(agentRun.itemId, itemId)).orderBy(desc(agentRun.id));

  return { item, attachments, findings, runs };
}
