import { readAdoSettings, readVaults, saveAdoSettings, type AdoSettings } from "@adoa/core";
import type { AdoaDb } from "@adoa/db";

// First start only, into the first vault: after that, Settings in the web UI own these values. A vault whose saved
// integration has no token yet gets ADO_PAT from .env (the token moved into Settings on 2026-10-06).
export async function seedAdoSettingsFromEnv(db: AdoaDb): Promise<void> {
  const vaults = await readVaults(db);
  const [first] = vaults;
  const seed = readSeed();

  if (first && seed && !(await readAdoSettings(db, first.name))) {
    await saveAdoSettings(db, first.name, seed);
    console.log(`ADO settings of ${first.name} seeded from ADOA_SEED_* env`);
  }

  for (const vault of vaults) {
    await seedToken(db, vault.name);
  }
}

async function seedToken(db: AdoaDb, vault: string): Promise<void> {
  const existing = await readAdoSettings(db, vault);
  const pat = process.env.ADO_PAT?.trim();

  if (!existing || existing.pat || !pat) {
    return;
  }

  await saveAdoSettings(db, vault, { ...existing, pat });
  console.log(`ADO token of ${vault} seeded from ADO_PAT`);
}

function readSeed(): AdoSettings | null {
  const seed = {
    orgUrl: process.env.ADOA_SEED_ADO_ORG_URL ?? "",
    project: process.env.ADOA_SEED_ADO_PROJECT ?? "",
    team: process.env.ADOA_SEED_ADO_TEAM ?? "",
    user: process.env.ADOA_SEED_ADO_USER ?? "",
  };

  return Object.values(seed).every(Boolean) ? { enabled: true, ...seed, pat: process.env.ADO_PAT?.trim() ?? "" } : null;
}
