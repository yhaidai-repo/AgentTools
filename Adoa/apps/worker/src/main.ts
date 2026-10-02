import { CONFLUENCE_QUEUE, DISPATCH_QUEUE, PBI_IMPORT_QUEUE, PBI_QUEUE, DRAFTS_QUEUE, PREPARE_QUEUE, REGISTER_QUEUE, SYNC_QUEUE, applyDispatchTick, applyDraftsSchedule, applyPbiImportSchedule, applySyncSchedule, saveConfluenceStatus, createWorkerBoss, ensureQueues, readImportSettings, readSyncSettings, type ConfluenceFetchJob, type DispatchJob, type PbiJob, type PrepareJob, type RegisterJob } from "@adoa/core";
import { ConfluenceClient } from "@adoa/confluence";
import { createDb } from "@adoa/db";
import { PostgresAgentConfigStore } from "@agenttools/config";
import { applyAgentSchedules } from "./dispatch/applyAgentSchedules";
import { dispatchAgent } from "./dispatch/dispatchAgent";
import { loadLinkedPage } from "./documents/confluencePages";
import { submitFinding } from "./drafts/submitFinding";
import { syncDraftTasks } from "./drafts/syncDraftTasks";
import { requireEnv, vaultRoot } from "./env";
import { runPbiImport } from "./import/runPbiImport";
import type { WorkerContext } from "./models/WorkerContext";
import { deletePbi } from "./pbi/deletePbi";
import { preparePbis } from "./prepare/preparePbis";
import { refreshPbi, refreshQueuedPbis } from "./refreshPbi";
import { seedAdoSettingsFromEnv } from "./seedSettings";
import { runSync } from "./sync/runSync";
import { syncOnePbi } from "./sync/syncOnePbi";

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
// Settings shows whether Confluence pages can be fetched; the web never sees the token.
await saveConfluenceStatus(db, { email: ConfluenceClient.fromEnv() ? process.env.CONFLUENCE_EMAIL!.trim() : null });
await applySyncSchedule(boss, (await readSyncSettings(db)).cron);
await applyDispatchTick(boss);
await applyDraftsSchedule(boss);
await applyPbiImportSchedule(boss, (await readImportSettings(db)).cron);
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

// "Load from Confluence" on the PBI page; the PBI is refreshed after, so its statuses and Vault show the page.
await boss.work<ConfluenceFetchJob>(CONFLUENCE_QUEUE, (jobs) => logged(CONFLUENCE_QUEUE, async () => {
  for (const job of jobs) {
    await loadLinkedPage(context, job.data.adoId, job.data.url);
    await refreshPbi(context, job.data.adoId);
  }
}));

// "Sync PBI" on the Backlog and "Delete from adoa" on a PBI page.
await boss.work<PbiJob>(PBI_QUEUE, (jobs) => logged(PBI_QUEUE, async () => {
  for (const job of jobs) {
    console.log(`pbi: ${job.data.action === "sync" ? await syncOrThrow(job.data.adoId) : await deletePbi(context, job.data.adoId)}`);
  }
}));

// PBI import (user decision 2026-10-02): one job reads every import source (Outlook mails, inbox requests, …).
await boss.work(PBI_IMPORT_QUEUE, () => logged(PBI_IMPORT_QUEUE, async () => {
  console.log(`pbi-import: ${await runPbiImport(context)}`);
}));

console.log("worker started");

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

// "Sync PBI" brings any PBI, whatever its ADO state (user decision 2026-10-02).
async function syncOrThrow(adoId: number): Promise<string> {
  const synced = await syncOnePbi(context, adoId, false);

  if (!synced.ok) {
    throw new Error(synced.error);
  }

  return synced.value;
}

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
