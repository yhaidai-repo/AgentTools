import type { AdoClient } from "@adoa/ado";
import { storeAttachment } from "@adoa/attachments";
import { createDocumentTask, handledDocumentUrls, linkedDocumentKind, pbiLinkedUrls } from "@adoa/core";
import type { AdoaDb, workItem } from "@adoa/db";
import type { WorkerContext } from "../models/WorkerContext";
import { syncPage } from "./confluencePages";

type WorkItemRow = typeof workItem.$inferSelect;

// Every document the PBI links ends up readable for the agents or as a human task asking for it (user decision 2026-10-01):
// ADO attachments are downloaded with the ADO token, Confluence pages fetched with the Confluence token (2026-10-02); web
// pages, and failed downloads, become tasks.
export async function collectLinkedDocuments(context: WorkerContext, client: AdoClient, row: WorkItemRow): Promise<void> {
  const handled = await handledDocumentUrls(context.db, row.adoId);
  const missing = pbiLinkedUrls(row).filter((url) => !handled.includes(url));

  for (const url of missing) {
    await collectOne(context, client, row.adoId, url);
  }
}

async function collectOne(context: WorkerContext, client: AdoClient, adoId: number, url: string): Promise<void> {
  const kind = linkedDocumentKind(url);

  if (kind === "confluence") {
    await syncPage(context, adoId, url, []);

    return;
  }

  if (kind !== "ado-attachment") {
    await createDocumentTask(context.db, adoId, url, null);

    return;
  }

  const problem = await downloadAdoAttachment(context.db, client, adoId, url);

  if (problem) {
    await createDocumentTask(context.db, adoId, url, problem);
  }
}

// Returns why the attachment couldn't be stored, or null when it was; the reason goes into the user's task.
async function downloadAdoAttachment(db: AdoaDb, client: AdoClient, adoId: number, url: string): Promise<string | null> {
  try {
    const stored = await storeAttachment(db, await client.downloadAttachment(url), { adoId, itemId: null, sourceUrl: url, origin: "ado" });

    return stored.ok ? null : stored.error;
  } catch (error) {
    return (error as Error).message;
  }
}
