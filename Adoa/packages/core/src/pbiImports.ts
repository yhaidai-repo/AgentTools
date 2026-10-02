import { pbiImport, type AdoaDb, type PbiImportResult } from "@adoa/db";
import { and, asc, desc, eq, max } from "drizzle-orm";
import type { ImportSourceActivity } from "./models/ImportSourceActivity";
import type { PbiImportRequest } from "./models/PbiImportRequest";

type PbiImportRow = typeof pbiImport.$inferSelect;

// A source that sent nothing for this long gets a warning in Settings (assumption, 2026-10-02).
const SOURCE_QUIET_MS = 24 * 60 * 60 * 1000;

export async function findImport(db: AdoaDb, source: string, sourceRef: string): Promise<PbiImportRow | null> {
  const [row] = await db.select().from(pbiImport).where(and(eq(pbiImport.source, source), eq(pbiImport.sourceRef, sourceRef)));

  return row ?? null;
}

// A re-sent item with a failed PBI is imported again; its row is updated with the new results.
export async function saveImport(db: AdoaDb, request: PbiImportRequest, results: PbiImportResult[]): Promise<number> {
  const values = {
    source: request.source,
    sourceRef: request.sourceRef,
    title: request.title ?? null,
    sender: request.from ?? null,
    occurredAt: request.occurredAt ? new Date(request.occurredAt) : null,
    results,
  };
  const [row] = await db
    .insert(pbiImport)
    .values(values)
    .onConflictDoUpdate({ target: [pbiImport.source, pbiImport.sourceRef], set: { ...values, updatedAt: new Date() } })
    .returning({ id: pbiImport.id });

  return row.id;
}

export function hasFailedResult(results: PbiImportResult[]): boolean {
  return results.some((result) => result.outcome === "failed");
}

// "4 PBIs: 2 prepared, 1 in-pipeline, 1 failed", or "no PBI links".
export function summarizeImportResults(results: PbiImportResult[]): string {
  if (results.length === 0) {
    return "no PBI links";
  }

  const counts = new Map<string, number>();

  results.forEach((result) => counts.set(result.outcome, (counts.get(result.outcome) ?? 0) + 1));

  const parts = [...counts].map(([outcome, count]) => `${count} ${outcome}`);

  return `${results.length} PBI(s): ${parts.join(", ")}`;
}

export async function readRecentImports(db: AdoaDb, source: string | null, limit: number): Promise<PbiImportRow[]> {
  const bySource = source ? eq(pbiImport.source, source) : undefined;

  return db.select().from(pbiImport).where(bySource).orderBy(desc(pbiImport.updatedAt)).limit(limit);
}

export async function readImportSourceActivity(db: AdoaDb): Promise<ImportSourceActivity[]> {
  const rows = await db
    .select({ source: pbiImport.source, lastImportAt: max(pbiImport.updatedAt) })
    .from(pbiImport)
    .groupBy(pbiImport.source)
    .orderBy(asc(pbiImport.source));

  return rows.map((row) => ({ source: row.source, lastImportAt: row.lastImportAt!, isQuiet: Date.now() - row.lastImportAt!.getTime() > SOURCE_QUIET_MS }));
}
