import type { AdoaDb } from "@adoa/db";
import { readValue, saveValue, vaultSettingKey } from "./settings";

const CURSOR_KEY = "syncCursor";

// A vault's sync fetches at most maxItemsPerRun details per run; the cursor is the last ado id handled.
export async function readSyncCursor(db: AdoaDb, vault: string): Promise<number> {
  return Number((await readValue<unknown>(db, vaultSettingKey(vault, CURSOR_KEY))) ?? 0);
}

export async function saveSyncCursor(db: AdoaDb, vault: string, lastAdoId: number): Promise<void> {
  await saveValue(db, vaultSettingKey(vault, CURSOR_KEY), lastAdoId);
}
