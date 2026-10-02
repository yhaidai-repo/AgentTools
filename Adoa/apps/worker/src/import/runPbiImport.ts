import { readImportSettings, saveImportStatus, summarizeImportResults } from "@adoa/core";
import { importInboxRoot } from "../env";
import type { PbiImportSource } from "../models/PbiImportSource";
import type { PendingImport } from "../models/PendingImport";
import type { WorkerContext } from "../models/WorkerContext";
import { importPbis } from "./importPbis";
import { importSources } from "./importSources";

// The pbi-import job (user decision 2026-10-02): reads every import source, imports each waiting item and tells the
// source how it went. At most maxItemsPerRun items over all sources; the rest wait for the next run.
export async function runPbiImport(context: WorkerContext): Promise<string> {
  const root = importInboxRoot();

  if (!root) {
    await saveImportStatus(context.db, { configured: false, checkedAt: new Date().toISOString(), sources: [] });

    return "IMPORT_INBOX_ROOT is not set";
  }

  const sources = importSources(root);
  const messages = await importFromSources(context, sources);

  await saveImportStatus(context.db, { configured: true, checkedAt: new Date().toISOString(), sources: await Promise.all(sources.map((source) => source.status())) });

  return messages.length > 0 ? messages.join("; ") : "nothing waiting";
}

async function importFromSources(context: WorkerContext, sources: PbiImportSource[]): Promise<string[]> {
  const { maxItemsPerRun } = await readImportSettings(context.db);
  const messages: string[] = [];

  for (const source of sources) {
    const pending = await source.readPending(maxItemsPerRun - messages.length);

    messages.push(...await importPending(context, pending));
  }

  return messages;
}

async function importPending(context: WorkerContext, pending: PendingImport[]): Promise<string[]> {
  const messages: string[] = [];

  for (const item of pending) {
    messages.push(`${item.label}: ${await importOne(context, item)}`);
  }

  return messages;
}

async function importOne(context: WorkerContext, item: PendingImport): Promise<string> {
  if (!item.request.ok) {
    await item.reject(item.request.error);

    return `set aside: ${item.request.error}`;
  }

  const outcome = await importPbis(context, item.request.value);

  // Not the item's fault (e.g. ADO not configured): it stays and is read again next run.
  if (!outcome.ok) {
    return `kept: ${outcome.error}`;
  }

  await item.complete();

  return outcome.value.repeated ? "imported before" : summarizeImportResults(outcome.value.results);
}
