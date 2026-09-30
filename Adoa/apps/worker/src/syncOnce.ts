import { createDb } from "@adoa/db";
import { requireEnv } from "./env";
import { seedAdoSettingsFromEnv } from "./seedSettings";
import { runSync } from "./sync/runSync";

// CLI: one sync without pg-boss, for local runs and troubleshooting.
const { db, pool } = createDb(requireEnv("DATABASE_URL"));

try {
  await seedAdoSettingsFromEnv(db);
  await runSync(db);
} finally {
  await pool.end();
}
