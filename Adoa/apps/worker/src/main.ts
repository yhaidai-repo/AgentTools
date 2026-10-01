import { DISPATCH_QUEUE, DRAFTS_QUEUE, PREPARE_QUEUE, REGISTER_QUEUE, SYNC_QUEUE, applyDispatchTick, applyDraftsSchedule, applySyncSchedule, createWorkerBoss, ensureQueues, readSyncSettings, type DispatchJob, type PrepareJob, type RegisterJob } from "@adoa/core";
import { createDb } from "@adoa/db";
import { PostgresAgentConfigStore } from "@agenttools/config";
import { applyAgentSchedules } from "./dispatch/applyAgentSchedules";
import { dispatchAgent } from "./dispatch/dispatchAgent";
import { submitFinding } from "./drafts/submitFinding";
import { syncDraftTasks } from "./drafts/syncDraftTasks";
import { requireEnv, vaultRoot } from "./env";
import type { WorkerContext } from "./models/WorkerContext";
import { preparePbis } from "./prepare/preparePbis";
import { refreshQueuedPbis } from "./refreshPbi";
import { seedAdoSettingsFromEnv } from "./seedSettings";
import { runSync } from "./sync/runSync";

const databaseUrl = requireEnv("DATABASE_URL");
const { db, pool } = createDb(databaseUrl);
const boss = createWorkerBoss(databaseUrl);
const config = new PostgresAgentConfigStore(pool);
const context: WorkerContext = { db, config, boss, vaultRoot: vaultRoot() };

boss.on("error", (error) => console.error("pg-boss:", error));

await boss.start();
await ensureQueues(boss);
await config.ensureSchema();
await seedAdoSettingsFromEnv(db);
await applySyncSchedule(boss, (await readSyncSettings(db)).cron);
await applyDispatchTick(boss);
await applyDraftsSchedule(boss);
await applyAgentSchedules(boss, config);
await config.onChange(() => {
  applyAgentSchedules(boss, config).catch((error) => console.error("applying agent schedules after a config change failed:", error));
});

await boss.work(SYNC_QUEUE, () => logged(SYNC_QUEUE, async () => {
  await runSync(db);
}));
await boss.work<PrepareJob>(PREPARE_QUEUE, (jobs) => logged(PREPARE_QUEUE, async () => {
  for (const job of jobs) {
    const queued = await preparePbis(context, job.data.adoIds);

    console.log(`prepare: ${job.data.adoIds.length} PBI note(s) written, ${queued} refinement task(s) queued (a PBI with an open one gets none)`);
  }
}));
// Every message: the PBIs referenced by queued agent tasks are brought up to date (documents, merged drafts, next tasks,
// statuses, Vault). With an agent id (its schedule or "Run now"): that agent's open tasks are validated and started.
await boss.work<DispatchJob>(DISPATCH_QUEUE, (jobs) => logged(DISPATCH_QUEUE, async () => {
  for (const job of jobs) {
    await dispatch(job.data);
  }
}));

// The drafts job: every vault draft gets a tech-writer task; tasks whose draft is gone are done.
await boss.work(DRAFTS_QUEUE, () => logged(DRAFTS_QUEUE, async () => {
  console.log(`drafts: ${await syncDraftTasks(db)}`);
}));
await boss.work<RegisterJob>(REGISTER_QUEUE, (jobs) => logged(REGISTER_QUEUE, async () => {
  for (const job of jobs) {
    console.log(`register: ${await submitFinding(db, job.data)}`);
  }
}));

console.log("worker started");

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

async function dispatch(job: DispatchJob): Promise<void> {
  await refreshQueuedPbis(context, job.agentId);

  if (job.agentId) {
    console.log(`dispatch ${await dispatchAgent(context, job.agentId)}`);
  }
}

// No silent failures: every job error is logged here and kept by pg-boss (shown on the Agents page).
async function logged(job: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error(`${job} job failed:`, error);
    throw error;
  }
}

async function stop(): Promise<void> {
  await boss.stop();
  await pool.end();
  process.exit(0);
}
