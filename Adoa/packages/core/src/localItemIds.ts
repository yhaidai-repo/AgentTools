import { localItem, type AdoaDb } from "@adoa/db";
import { and, eq, like } from "drizzle-orm";

export type ItemPrefix = "RT" | "AT" | "DT" | "HT" | "Q" | "RR";

// Items that may have no PBI (tech-writer tasks, their findings) are numbered across the app: `WT-001`, `F-001`.
export type GlobalItemPrefix = "WT" | "F";

// Ids are `<prefix>-<adoId>-<nnn>`, numbered per PBI and prefix; never reused.
export async function nextItemId(db: AdoaDb, prefix: ItemPrefix, adoId: number): Promise<string> {
  const stem = `${prefix}-${adoId}-`;
  const rows = await db.select({ id: localItem.id }).from(localItem).where(and(eq(localItem.pbiId, adoId), like(localItem.id, `${stem}%`)));
  const highest = rows.reduce((max, row) => Math.max(max, Number(row.id.slice(stem.length)) || 0), 0);

  return `${stem}${String(highest + 1).padStart(3, "0")}`;
}

export async function nextGlobalItemId(db: AdoaDb, prefix: GlobalItemPrefix): Promise<string> {
  return nextScopedItemId(db, `${prefix}-`);
}

// The next `<stem><nnn>` across all items, e.g. stem `CR-6322-` for the review tasks of pull request 6322.
export async function nextScopedItemId(db: AdoaDb, stem: string): Promise<string> {
  const rows = await db.select({ id: localItem.id }).from(localItem).where(like(localItem.id, `${stem}%`));
  const highest = rows.reduce((max, row) => Math.max(max, Number(row.id.slice(stem.length)) || 0), 0);

  return `${stem}${String(highest + 1).padStart(3, "0")}`;
}
