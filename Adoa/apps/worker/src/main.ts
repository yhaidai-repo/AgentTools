import { PREPARE_QUEUE, SYNC_QUEUE, applySyncSchedule, createWorkerBoss, ensureQueues, readSyncSettings, type PrepareJob } from "@adoa/core";
import { createDb } from "@adoa/db";
import { requireEnv } from "./env";
import { preparePbis } from "./prepare/preparePbis";
import { seedAdoSettingsFromEnv } from "./seedSettings";
import { runSync } from "./sync/runSync";

const databaseUrl = requireEnv("DATABASE_URL");
const { db, pool } = createDb(databaseUrl);
const boss = createWorkerBoss(databaseUrl);

boss.on("error", (error) => console.error("pg-boss:", error));

await boss.start();
await ensureQueues(boss);
await seedAdoSettingsFromEnv(db);
await applySyncSchedule(boss, (await readSyncSettings(db)).cron);
await boss.work(SYNC_QUEUE, async () => runSync(db));
await boss.work<PrepareJob>(PREPARE_QUEUE, async (jobs) => {
  for (const job of jobs) {
    const prepared = await preparePbis(db, job.data.adoIds);

    console.log(`prepare: ${prepared} of ${job.data.adoIds.length} PBIs ready for refinement`);
  }
});

console.log("worker started");

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

async function stop(): Promise<void> {
  await boss.stop();
  await pool.end();
  process.exit(0);
}
