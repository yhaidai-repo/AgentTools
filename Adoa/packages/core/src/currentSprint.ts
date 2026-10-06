import { config, type AdoaDb } from "@adoa/db";
import { like } from "drizzle-orm";
import { readValue, saveValue, vaultSettingKey } from "./settings";

const CURRENT_SPRINT_KEY = "currentSprint";

// Written by the vault's sync (which knows ADO's current iteration), read by agents to take the current sprint first.
export async function saveCurrentSprint(db: AdoaDb, vault: string, iterationPath: string): Promise<void> {
  await saveValue(db, vaultSettingKey(vault, CURRENT_SPRINT_KEY), iterationPath);
}

export async function readCurrentSprint(db: AdoaDb, vault: string): Promise<string | null> {
  const value = await readValue<unknown>(db, vaultSettingKey(vault, CURRENT_SPRINT_KEY));

  return typeof value === "string" ? value : null;
}

// Every vault's current sprint: the dispatcher takes tasks of any current sprint first.
export async function readCurrentSprints(db: AdoaDb): Promise<string[]> {
  const rows = await db.select({ value: config.value }).from(config).where(like(config.key, vaultSettingKey("%", CURRENT_SPRINT_KEY)));

  return rows.map((row) => row.value).filter((value): value is string => typeof value === "string");
}
