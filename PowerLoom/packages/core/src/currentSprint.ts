import type { PowerLoomDb } from "@powerloom/db";
import { readValue, saveValue, vaultSettingKey } from "./settings";

const CURRENT_SPRINT_KEY = "currentSprint";

// Written by the vault's sync (which knows ADO's current iteration); PowerLoom's dispatch takes the current sprint first.
export async function saveCurrentSprint(db: PowerLoomDb, vault: string, iterationPath: string): Promise<void> {
  await saveValue(db, vaultSettingKey(vault, CURRENT_SPRINT_KEY), iterationPath);
}

export async function readCurrentSprint(db: PowerLoomDb, vault: string): Promise<string | null> {
  const value = await readValue<unknown>(db, vaultSettingKey(vault, CURRENT_SPRINT_KEY));

  return typeof value === "string" ? value : null;
}
