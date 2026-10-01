import { localItem, type AdoaDb } from "@adoa/db";
import { and, eq, like } from "drizzle-orm";

export type ItemPrefix = "AT" | "HT" | "Q" | "RR";

// Ids are `<prefix>-<adoId>-<nnn>`, numbered per PBI and prefix; never reused.
export async function nextItemId(db: AdoaDb, prefix: ItemPrefix, adoId: number): Promise<string> {
  const stem = `${prefix}-${adoId}-`;
  const rows = await db.select({ id: localItem.id }).from(localItem).where(and(eq(localItem.pbiId, adoId), like(localItem.id, `${stem}%`)));
  const highest = rows.reduce((max, row) => Math.max(max, Number(row.id.slice(stem.length)) || 0), 0);

  return `${stem}${String(highest + 1).padStart(3, "0")}`;
}
