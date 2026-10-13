import { documentUrl, linkedDocumentKind, pbiLinkedUrls } from "@powerloom/core";
import { attachment, localItem, workItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { TaskContext } from "../models/TaskContext";
import type { WebDocumentRun } from "./models/WebDocumentRun";

type ItemRow = typeof localItem.$inferSelect;

// The user settled a document by closing the task asking for it (PowerLoom's TaskValidation does the same).
const SETTLED_TASK_STATUSES: (typeof localItem.$inferSelect)["status"][] = ["done", "cancelled"];

// Web pages a PBI links are read by agents with web access (user decision 2026-10-14): the ones still unread, for an
// agent with web access working on a PBI; null for any other run.
export async function webDocumentRun(context: TaskContext, task: ItemRow, runId: number): Promise<WebDocumentRun | null> {
  if (!context.agent.capabilities.webAccess || task.pbiId === null) {
    return null;
  }

  return { adoId: task.pbiId, agentId: context.agent.id, taskId: task.id, runId, urls: await unreadWebDocuments(context.deps.db, task.pbiId) };
}

// The PBI's web pages with no content attached and no closed task asking for one.
export async function unreadWebDocuments(db: PowerLoomDb, adoId: number): Promise<string[]> {
  const [pbi] = await db.select({ descriptionMd: workItem.descriptionMd, acceptanceCriteriaMd: workItem.acceptanceCriteriaMd }).from(workItem).where(eq(workItem.adoId, adoId));

  if (!pbi) {
    return [];
  }

  const settled = await settledUrls(db, adoId);

  return pbiLinkedUrls(pbi).filter((url) => linkedDocumentKind(url) === "web" && !settled.has(url));
}

export function webDocumentsBlock(run: WebDocumentRun | null): string {
  if (!run || run.urls.length === 0) {
    return "";
  }

  return [
    "<web-documents>",
    "Web pages the PBI links that no agent has read yet. You have web access: open each one with your web tools.",
    "Save what matters for this PBI with save_document_notes: the facts, rules and numbers, with the section each comes from. If nothing matters, save that, so no one asks for the page again.",
    "A page you can't open (login, 403, 404, timeout): request_document with what happened; the user then attaches it.",
    ...run.urls.map((url) => `- ${url}`),
    "</web-documents>",
  ].join("\n");
}

async function settledUrls(db: PowerLoomDb, adoId: number): Promise<Set<string>> {
  const attached = await db.select({ url: attachment.sourceUrl }).from(attachment).where(and(eq(attachment.pbiId, adoId), isNotNull(attachment.sourceUrl)));
  const closedTasks = await db
    .select({ url: sql<string>`${localItem.data}->>'url'` })
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), eq(localItem.kind, "human"), inArray(localItem.status, SETTLED_TASK_STATUSES), sql`${localItem.data}->>'url' is not null`));

  return new Set([...attached, ...closedTasks].map((row) => documentUrl(row.url!)));
}
