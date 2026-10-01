import type { AdoClient } from "@adoa/ado";
import { storeAttachment } from "@adoa/attachments";
import { createDocumentTask, handledDocumentUrls, linkedDocumentKind, pbiLinkedUrls } from "@adoa/core";
import type { AdoaDb, workItem } from "@adoa/db";

type WorkItemRow = typeof workItem.$inferSelect;

// Every document the PBI links ends up readable for the agents or as a human task asking for it (user decision 2026-10-01):
// ADO attachments are downloaded with the ADO token; Confluence and web pages, and failed downloads, become tasks.
export async function collectLinkedDocuments(db: AdoaDb, client: AdoClient, row: WorkItemRow): Promise<void> {
  const handled = await handledDocumentUrls(db, row.adoId);
  const missing = pbiLinkedUrls(row).filter((url) => !handled.includes(url));

  for (const url of missing) {
    await collectOne(db, client, row.adoId, url);
  }
}

async function collectOne(db: AdoaDb, client: AdoClient, adoId: number, url: string): Promise<void> {
  if (linkedDocumentKind(url) !== "ado-attachment") {
    await createDocumentTask(db, adoId, url, null);

    return;
  }

  const problem = await downloadAdoAttachment(db, client, adoId, url);

  if (problem) {
    await createDocumentTask(db, adoId, url, problem);
  }
}

// Returns why the attachment couldn't be stored, or null when it was; the reason goes into the user's task.
async function downloadAdoAttachment(db: AdoaDb, client: AdoClient, adoId: number, url: string): Promise<string | null> {
  try {
    const stored = await storeAttachment(db, await client.downloadAttachment(url), { adoId, itemId: null, sourceUrl: url });

    return stored.ok ? null : stored.error;
  } catch (error) {
    return (error as Error).message;
  }
}
