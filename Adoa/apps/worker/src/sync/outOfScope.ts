import { workItem, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, notInArray } from "drizzle-orm";

// Items that left the query are flagged, never deleted.
export async function findNewlyOutOfScope(db: AdoaDb, scopeIds: number[]): Promise<number[]> {
  const inScope = eq(workItem.outOfScope, false);
  const filter = scopeIds.length > 0 ? and(inScope, notInArray(workItem.adoId, scopeIds)) : inScope;
  const rows = await db.select({ adoId: workItem.adoId }).from(workItem).where(filter);

  return rows.map((row) => row.adoId);
}

export async function markOutOfScope(db: AdoaDb, adoIds: number[]): Promise<void> {
  if (adoIds.length === 0) {
    return;
  }

  await db.update(workItem).set({ outOfScope: true }).where(inArray(workItem.adoId, adoIds));
}
