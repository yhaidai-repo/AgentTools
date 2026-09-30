import { config, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";

const CURSOR_KEY = "syncCursor";

// Sync fetches at most maxItemsPerRun details per run; the cursor is the last ado id handled.
export async function readSyncCursor(db: AdoaDb): Promise<number> {
  const rows = await db.select().from(config).where(eq(config.key, CURSOR_KEY));

  return Number(rows[0]?.value ?? 0);
}

export async function saveSyncCursor(db: AdoaDb, lastAdoId: number): Promise<void> {
  await db
    .insert(config)
    .values({ key: CURSOR_KEY, value: lastAdoId })
    .onConflictDoUpdate({ target: config.key, set: { value: lastAdoId, updatedAt: new Date() } });
}
