import type { AdoaDb } from "@adoa/db";
import { readValue, saveValue, vaultSettingKey } from "./settings";

const CURRENT_SPRINT_KEY = "currentSprint";

// Written by the vault's sync (which knows ADO's current iteration); PowerLoom's dispatch takes the current sprint first.
export async function saveCurrentSprint(db: AdoaDb, vault: string, iterationPath: string): Promise<void> {
  await saveValue(db, vaultSettingKey(vault, CURRENT_SPRINT_KEY), iterationPath);
}

export async function readCurrentSprint(db: AdoaDb, vault: string): Promise<string | null> {
  const value = await readValue<unknown>(db, vaultSettingKey(vault, CURRENT_SPRINT_KEY));

  return typeof value === "string" ? value : null;
}
