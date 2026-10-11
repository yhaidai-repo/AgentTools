import { localItem, type PowerLoomDb } from "@powerloom/db";
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

export async function hasItemWithKey(db: PowerLoomDb, adoId: number, key: string): Promise<boolean> {
  const rows = await db.select({ id: localItem.id }).from(localItem).where(and(eq(localItem.pbiId, adoId), sql`${localItem.data}->>'key' = ${key}`)).limit(1);

  return rows.length > 0;
}
