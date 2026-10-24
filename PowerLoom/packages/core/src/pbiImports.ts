import { pbiImport, type PowerLoomDb } from "@powerloom/db";
import { and, asc, desc, eq, max } from "drizzle-orm";
import type { ImportSourceActivity } from "./models/ImportSourceActivity";

type PbiImportRow = typeof pbiImport.$inferSelect;

// A source that sent nothing for this long gets a warning in Settings (assumption, 2026-10-02).
const SOURCE_QUIET_MS = 24 * 60 * 60 * 1000;

export async function readRecentImports(db: PowerLoomDb, vault: string, source: string | null, limit: number): Promise<PbiImportRow[]> {
  const bySource = source ? eq(pbiImport.source, source) : undefined;

  return db.select().from(pbiImport).where(and(eq(pbiImport.vault, vault), bySource)).orderBy(desc(pbiImport.updatedAt)).limit(limit);
}

export async function readImportSourceActivity(db: PowerLoomDb, vault: string): Promise<ImportSourceActivity[]> {
  const rows = await db
    .select({ source: pbiImport.source, lastImportAt: max(pbiImport.updatedAt) })
    .from(pbiImport)
    .where(eq(pbiImport.vault, vault))
    .groupBy(pbiImport.source)
    .orderBy(asc(pbiImport.source));

  return rows.map((row) => ({ source: row.source, lastImportAt: row.lastImportAt!, isQuiet: Date.now() - row.lastImportAt!.getTime() > SOURCE_QUIET_MS }));
}
