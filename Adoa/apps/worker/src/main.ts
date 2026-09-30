import { SYNC_QUEUE, applySyncSchedule, createWorkerBoss, ensureSyncQueue, readSyncSettings } from "@adoa/core";
import { createDb } from "@adoa/db";
import { requireEnv } from "./env";
import { seedAdoSettingsFromEnv } from "./seedSettings";
import { runSync } from "./sync/runSync";

const databaseUrl = requireEnv("DATABASE_URL");
const { db, pool } = createDb(databaseUrl);
const boss = createWorkerBoss(databaseUrl);

boss.on("error", (error) => console.error("pg-boss:", error));

await boss.start();
await ensureSyncQueue(boss);
await seedAdoSettingsFromEnv(db);
await applySyncSchedule(boss, (await readSyncSettings(db)).cron);
await boss.work(SYNC_QUEUE, async () => runSync(db));

console.log("worker started");

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

async function stop(): Promise<void> {
  await boss.stop();
  await pool.end();
  process.exit(0);
}
