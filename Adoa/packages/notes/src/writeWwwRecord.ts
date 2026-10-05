import { wwwRecord, type AdoaDb } from "@adoa/db";
import { VaultWriter, appendWwwRecord, type WwwEntry } from "@adoa/vault";
import { eq } from "drizzle-orm";
import { join } from "node:path";

type WwwRecordRow = typeof wwwRecord.$inferSelect;

const LOG_FILE = "www-log.md";

// Appends a stored WWW record to its vault's www-log.md (once: a written record keeps its WWW-nnn) and recalculates the
// log's statistics. A vault without the log gets none; the row keeps the reason.
export async function writeWwwRecord(db: AdoaDb, vaultsDir: string, id: number): Promise<string> {
  const [row] = await db.select().from(wwwRecord).where(eq(wwwRecord.id, id));

  if (!row || row.recordId) {
    return row ? `www record ${id}: already ${row.recordId}` : `www record ${id}: not found`;
  }

  const writer = new VaultWriter(join(vaultsDir, row.vault));
  const log = await writer.readText(LOG_FILE);

  if (log === null) {
    await db.update(wwwRecord).set({ error: `${row.vault} has no ${LOG_FILE}` }).where(eq(wwwRecord.id, id));

    return `www record ${id}: ${row.vault} has no ${LOG_FILE}`;
  }

  const appended = appendWwwRecord(log, toEntry(row), new Date().toISOString().slice(0, 10));

  await writer.writeText(LOG_FILE, appended.text);
  await db.update(wwwRecord).set({ recordId: appended.recordId, writtenAt: new Date(), error: null }).where(eq(wwwRecord.id, id));

  return `${appended.recordId} written to ${row.vault}`;
}

function toEntry(row: WwwRecordRow): WwwEntry {
  return {
    title: row.title,
    kind: row.kind as WwwEntry["kind"],
    project: row.project,
    planned: row.planned,
    happened: row.happened,
    fault: row.fault as WwwEntry["fault"],
    rootCause: row.rootCause,
    resolution: row.resolution,
    preventiveAction: row.preventiveAction,
    assumptions: row.assumptions,
  };
}
