import { localItem, type itemStatus, type PowerLoomDb } from "@powerloom/db";
import { and, eq, sql } from "drizzle-orm";

// App-generated items carry a key naming their subject (local_item.data.key), so a rerun never creates the same item
// twice, whatever its status. A unique index (PBI, key) backs this up.

export function repoConfirmationKey(repos: string[]): string {
  return `repos:${[...repos].sort().join(",")}`;
}

export function documentKey(url: string): string {
  return `doc:${url}`;
}

export function draftKey(captureId: number): string {
  return `draft:${captureId}`;
}

// The status of the PBI's item with this key; null when there is none yet.
export async function itemStatusWithKey(db: PowerLoomDb, adoId: number, key: string): Promise<(typeof itemStatus.enumValues)[number] | null> {
  const [row] = await db.select({ status: localItem.status }).from(localItem).where(and(eq(localItem.pbiId, adoId), sql`${localItem.data}->>'key' = ${key}`)).limit(1);

  return row?.status ?? null;
}
