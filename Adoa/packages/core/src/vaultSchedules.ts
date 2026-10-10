import type { AdoaDb } from "@adoa/db";
import type { PgBoss } from "pg-boss";
import type { Vault } from "./models/Vault";
import { PBI_IMPORT_QUEUE, applyVaultSchedules } from "./queues";
import { isAdoActive, readAdoSettings, readImportSettings } from "./settings";
import { readVaults } from "./vaults";

// The per-vault jobs as the vaults' features and settings say (user decision 2026-10-05): a vault with a feature off, or
// without an active ADO integration (user decision 2026-10-06), has no schedule for it. Applied by the worker at start
// and by the web after a settings save.
export async function applyVaultJobSchedules(boss: PgBoss, db: AdoaDb): Promise<void> {
  const vaults = await activeAdoVaults(db, await readVaults(db));

  await applyVaultSchedules(boss, PBI_IMPORT_QUEUE, await cronsOf(db, vaults, "mailSync", (vault) => readImportSettings(db, vault)));
}

async function activeAdoVaults(db: AdoaDb, vaults: Vault[]): Promise<Vault[]> {
  const active = await Promise.all(vaults.map(async (vault) => isAdoActive(await readAdoSettings(db, vault.name))));

  return vaults.filter((_, index) => active[index]);
}

async function cronsOf(db: AdoaDb, vaults: Vault[], feature: keyof Vault["features"], settingsOf: (vault: string) => Promise<{ cron: string }>): Promise<Map<string, string>> {
  const enabled = vaults.filter((vault) => vault.features[feature]);
  const crons = await Promise.all(enabled.map(async (vault) => [vault.name, (await settingsOf(vault.name)).cron] as const));

  return new Map(crons);
}
