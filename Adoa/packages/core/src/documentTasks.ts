import { attachment, localItem, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { createHumanTask } from "./humanItems";
import { setItemStatus } from "./pbiStatus";
import { linkedDocumentKind } from "./urls";

const KIND_LABELS = { confluence: "Confluence page", "ado-attachment": "ADO attachment", web: "document" };

// Linked documents agents can't open become human tasks (user decision 2026-10-01): the user attaches the content, or cancels
// the task when agents don't need it. Like every human task, it blocks the agents while open.

// URLs already handled: content uploaded, or a task asked for (in any status, so a cancelled one isn't asked again).
export async function handledDocumentUrls(db: AdoaDb, adoId: number): Promise<string[]> {
  const uploaded = await db.select({ url: attachment.sourceUrl }).from(attachment).where(and(eq(attachment.pbiId, adoId), isNotNull(attachment.sourceUrl)));
  const asked = await db.select({ url: sql<string>`${localItem.data}->>'url'` }).from(localItem).where(and(eq(localItem.pbiId, adoId), eq(localItem.kind, "human"), sql`${localItem.data}->>'url' IS NOT NULL`));

  return [...uploaded, ...asked].map((row) => row.url as string);
}

export async function createDocumentTask(db: AdoaDb, adoId: number, url: string, problem: string | null): Promise<string> {
  const label = KIND_LABELS[linkedDocumentKind(url)];
  const why = problem ? `adoa couldn't fetch it: ${problem}` : "Agents can't open it (no access to Confluence or the web).";

  return createHumanTask(db, {
    adoId,
    title: `Attach the content of the linked ${label}`,
    body: `The PBI links ${url}\n\n${why}\n\nUpload it here (PDF, Word, saved HTML or text). Cancel the task if the agents don't need it.`,
    runId: null,
    data: { url },
  });
}

// An upload for a linked document (from its task or from "Add attachment") closes the tasks asking for it.
export async function closeDocumentTasks(db: AdoaDb, adoId: number, url: string, resolution: string): Promise<string[]> {
  const open = await db
    .select({ id: localItem.id, status: localItem.status })
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), eq(localItem.kind, "human"), inArray(localItem.status, ["open", "in-progress"]), sql`${localItem.data}->>'url' = ${url}`));

  for (const task of open) {
    await db.update(localItem).set({ resolution }).where(eq(localItem.id, task.id));
    await setItemStatus(db, task.id, task.status, "done", "human");
  }

  return open.map((task) => task.id);
}
