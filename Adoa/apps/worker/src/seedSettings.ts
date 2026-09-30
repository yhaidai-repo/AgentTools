import { readAdoSettings, saveAdoSettings, type AdoSettings } from "@adoa/core";
import type { AdoaDb } from "@adoa/db";

// First start only: after that, Settings in the web UI own these values.
export async function seedAdoSettingsFromEnv(db: AdoaDb): Promise<void> {
  const existing = await readAdoSettings(db);
  const seed = readSeed();

  if (existing || !seed) {
    return;
  }

  await saveAdoSettings(db, seed);
  console.log("ADO settings seeded from ADOA_SEED_* env");
}

function readSeed(): AdoSettings | null {
  const seed = {
    orgUrl: process.env.ADOA_SEED_ADO_ORG_URL ?? "",
    project: process.env.ADOA_SEED_ADO_PROJECT ?? "",
    team: process.env.ADOA_SEED_ADO_TEAM ?? "",
    user: process.env.ADOA_SEED_ADO_USER ?? "",
  };

  return Object.values(seed).every(Boolean) ? seed : null;
}
