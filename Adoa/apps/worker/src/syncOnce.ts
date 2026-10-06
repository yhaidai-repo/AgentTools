import { readVaults } from "@adoa/core";
import { createDb } from "@adoa/db";
import { requireEnv } from "./env";
import { seedAdoSettingsFromEnv } from "./seedSettings";
import { runSync } from "./sync/runSync";

// CLI: one sync of a vault without pg-boss, for local runs and troubleshooting: `npm run sync:once -- <vault>` (the
// first vault when none is given).
const { db, pool } = createDb(requireEnv("DATABASE_URL"));

try {
  await seedAdoSettingsFromEnv(db);

  const vault = process.argv[2] ?? (await readVaults(db))[0]?.name;

  if (!vault) {
    throw new Error("no vault is configured");
  }

  await runSync(db, vault);
} finally {
  await pool.end();
}
