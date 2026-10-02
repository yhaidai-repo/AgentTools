import { deletedPbiIds, extractPbiLinks, findImport, hasFailedResult, readAdoSettings, saveImport, type AdoSettings, type Outcome, type PbiImportOutcome, type PbiImportRequest } from "@adoa/core";
import { workItem, type PbiImportResult } from "@adoa/db";
import { inArray } from "drizzle-orm";
import type { WorkerContext } from "../models/WorkerContext";
import { preparePbis } from "../prepare/preparePbis";
import { syncOnePbi } from "../sync/syncOnePbi";

// Statuses a PBI has before it's prepared (or after ADO content changed); any other status means it's in the pipeline,
// and an import must not start a re-refinement (assumption, 2026-10-02).
const PREPARABLE = ["new", "stale"];

// The one import every source uses (user decision 2026-10-02): sync each PBI the item names, then prepare the new ones.
export async function importPbis(context: WorkerContext, request: PbiImportRequest): Promise<Outcome<PbiImportOutcome>> {
  const ado = await readAdoSettings(context.db);

  if (!ado) {
    return { ok: false, error: "ADO settings are not configured" };
  }

  const previous = await findImport(context.db, request.source, request.sourceRef);

  if (previous && !hasFailedResult(previous.results)) {
    return { ok: true, value: { importId: previous.id, results: previous.results, repeated: true } };
  }

  const synced = await syncAll(context, requestedPbiIds(ado, request));
  const results = request.prepare === false ? synced : await prepareNew(context, synced);
  const importId = await saveImport(context.db, request, results);

  return { ok: true, value: { importId, results, repeated: false } };
}

function requestedPbiIds(ado: AdoSettings, request: PbiImportRequest): number[] {
  const linked = extractPbiLinks(ado, request.html, request.text);

  return [...new Set([...(request.adoIds ?? []), ...linked])];
}

// PBIs deleted in adoa stay deleted (assumption, 2026-10-02): only Sync PBI on the Backlog brings one back.
async function syncAll(context: WorkerContext, adoIds: number[]): Promise<PbiImportResult[]> {
  const deleted = new Set(await deletedPbiIds(context.db));
  const results: PbiImportResult[] = [];

  for (const adoId of adoIds) {
    results.push(deleted.has(adoId) ? { adoId, outcome: "deleted" } : await syncOne(context, adoId));
  }

  return results;
}

// One PBI failing (not in ADO, no access) doesn't stop the others; one already started in ADO is refused.
async function syncOne(context: WorkerContext, adoId: number): Promise<PbiImportResult> {
  try {
    const synced = await syncOnePbi(context, adoId, true);

    return synced.ok ? { adoId, outcome: "synced" } : { adoId, outcome: "refused", detail: synced.error };
  } catch (error) {
    return { adoId, outcome: "failed", detail: (error as Error).message };
  }
}

async function prepareNew(context: WorkerContext, results: PbiImportResult[]): Promise<PbiImportResult[]> {
  const preparable = await preparableIds(context, results);

  if (preparable.size === 0) {
    return results.map((result) => markInPipeline(result, preparable));
  }

  try {
    await preparePbis(context, [...preparable]);
  } catch (error) {
    return results.map((result) => markPrepareFailed(result, preparable, (error as Error).message));
  }

  return results.map((result) => markPrepared(result, preparable));
}

async function preparableIds(context: WorkerContext, results: PbiImportResult[]): Promise<Set<number>> {
  const syncedIds = results.filter((result) => result.outcome === "synced").map((result) => result.adoId);

  if (syncedIds.length === 0) {
    return new Set();
  }

  const rows = await context.db.select({ adoId: workItem.adoId, status: workItem.pipelineStatus }).from(workItem).where(inArray(workItem.adoId, syncedIds));

  return new Set(rows.filter((row) => PREPARABLE.includes(row.status)).map((row) => row.adoId));
}

function markPrepared(result: PbiImportResult, preparable: Set<number>): PbiImportResult {
  return preparable.has(result.adoId) ? { ...result, outcome: "prepared" } : markInPipeline(result, preparable);
}

function markInPipeline(result: PbiImportResult, preparable: Set<number>): PbiImportResult {
  const isLeftAlone = result.outcome === "synced" && !preparable.has(result.adoId);

  return isLeftAlone ? { ...result, outcome: "in-pipeline" } : result;
}

function markPrepareFailed(result: PbiImportResult, preparable: Set<number>, reason: string): PbiImportResult {
  return preparable.has(result.adoId) ? { ...result, outcome: "failed", detail: `Synced, but not prepared: ${reason}` } : markInPipeline(result, preparable);
}
