import { localItem } from "@powerloom/db";
import { and, eq, sql } from "drizzle-orm";
import type { HeldTask } from "@/models/HeldTask";
import { getDb } from "./db";

// The vault's open agent tasks the dispatcher holds back, oldest first: the reasons are what the user can act on.
export async function loadHeldTasks(vault: string): Promise<HeldTask[]> {
  const rows = await getDb()
    .select({ id: localItem.id, kind: localItem.kind, title: localItem.title, pbiId: localItem.pbiId, vault: localItem.vault, heldBy: localItem.heldBy, updatedAt: localItem.updatedAt })
    .from(localItem)
    .where(and(eq(localItem.status, "open"), eq(localItem.vault, vault), sql`jsonb_array_length(${localItem.heldBy}) > 0`))
    .orderBy(localItem.updatedAt);

  return rows.map((row) => ({ ...row, updatedAt: new Date(row.updatedAt) }));
}
