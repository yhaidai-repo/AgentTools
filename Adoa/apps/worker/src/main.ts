import { CONFLUENCE_QUEUE, DISPATCH_QUEUE, PBI_IMPORT_QUEUE, PBI_QUEUE, PULL_REQUESTS_QUEUE, DRAFTS_QUEUE, PREPARE_QUEUE, REGISTER_QUEUE, SYNC_QUEUE, TASK_SCHEDULE_QUEUE, REVIEW_NOTE_QUEUE, VAULT_INIT_QUEUE, VAULT_TRASH_QUEUE, WWW_QUEUE, applyDispatchTick, applyDraftsSchedule, applyTaskSchedules, applyVaultJobSchedules, listTaskSchedules, saveConfluenceStatus, vaultBacklogRoot, vaultOfPbi, createWorkerBoss, ensureQueues, type ConfluenceFetchJob, type DispatchJob, type PbiJob, type ReviewNoteJob, type VaultJob, type VaultTrashJob, type WwwJob, type PrepareJob, type RegisterJob, type TaskScheduleJob } from "@adoa/core";
import { ConfluenceClient } from "@adoa/confluence";
import { createDb, pullRequest } from "@adoa/db";
import { eq } from "drizzle-orm";
import { initVault, writeReviewNote, writeWwwRecord } from "@adoa/notes";
import { deleteFromTrash, restoreFromTrash } from "@adoa/vault";
import { PostgresAgentConfigStore } from "@agenttools/config";
import { applyAgentSchedules } from "./dispatch/applyAgentSchedules";
import { dispatchAgent } from "./dispatch/dispatchAgent";
import { loadLinkedPage } from "./documents/confluencePages";
import { submitFinding } from "./drafts/submitFinding";
import { syncDraftTasks } from "./drafts/syncDraftTasks";
import { backlogMount, legacyBacklogFolder, requireEnv, vaultTemplateHome, vaultsHostRoot, vaultsRoot } from "./env";
import { migrateLegacyBacklog } from "./backlog/migrateLegacyBacklog";
import { runPbiImport } from "./import/runPbiImport";
import { syncPullRequests } from "./pullRequests/syncPullRequests";
import type { WorkerContext } from "./models/WorkerContext";
import { deletePbi } from "./pbi/deletePbi";
import { preparePbis } from "./prepare/preparePbis";
import { refreshPbi, refreshQueuedPbis } from "./refreshPbi";
import { seedAdoSettingsFromEnv } from "./seedSettings";
import { runSync } from "./sync/runSync";
import { syncOnePbi } from "./sync/syncOnePbi";
import { runScheduledTask } from "./schedules/runScheduledTask";

const databaseUrl = requireEnv("DATABASE_URL");
const { db, pool } = createDb(databaseUrl);
const boss = createWorkerBoss(databaseUrl);
const config = new PostgresAgentConfigStore(pool);
const context: WorkerContext = { db, config, boss, backlogMount: backlogMount() };

boss.on("error", (error) => console.error("pg-boss:", error));

await boss.start();
await ensureQueues(boss);
await config.ensureSchema();
await seedAdoSettingsFromEnv(db);

const moved = await migrateLegacyBacklog(db, context.backlogMount, legacyBacklogFolder());

if (moved) {
  console.log(moved);
}

// Settings shows whether Confluence pages can be fetched; the web never sees the token.
await saveConfluenceStatus(db, { email: ConfluenceClient.fromEnv() ? process.env.CONFLUENCE_EMAIL!.trim() : null });
// The per-vault jobs (sync, pbi-import, pull-requests) as the vaults' features say (user decision 2026-10-05).
await applyVaultJobSchedules(boss, db);
await applyDispatchTick(boss);
await applyDraftsSchedule(boss);
await applyTaskSchedules(boss, await listTaskSchedules(db));
await applyAgentSchedules(boss, config);
await config.onChange(() => {
  applyAgentSchedules(boss, config).catch((error) => console.error("applying agent schedules after a config change failed:", error));
});

await boss.work<VaultJob>(SYNC_QUEUE, (jobs) => logged(SYNC_QUEUE, async () => {
  for (const job of jobs) {
    await runSync(db, job.data.vault);
  }
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

// "Sync PBI" on the Backlog, "Delete from adoa" and "Continue with Claude" on a PBI page.
await boss.work<PbiJob>(PBI_QUEUE, (jobs) => logged(PBI_QUEUE, async () => {
  for (const job of jobs) {
    console.log(`pbi: ${await runPbiJob(job.data)}`);
  }
}));

// PBI import (user decision 2026-10-02): one job reads every import source (Outlook mails, inbox requests, …).
await boss.work<VaultJob>(PBI_IMPORT_QUEUE, (jobs) => logged(PBI_IMPORT_QUEUE, async () => {
  for (const job of jobs) {
    console.log(`pbi-import ${job.data.vault}: ${await runPbiImport(context, job.data.vault)}`);
  }
}));

// Code review (user decision 2026-10-02): the ADO pull requests the user reviews; new ones get a code-review task.
await boss.work<VaultJob>(PULL_REQUESTS_QUEUE, (jobs) => logged(PULL_REQUESTS_QUEUE, async () => {
  for (const job of jobs) {
    console.log(`pull-requests ${job.data.vault}: ${await syncPullRequests(context, job.data.vault)}`);
  }
}));

// Scheduled tasks (user decision 2026-10-03): a schedule's tick (or "Create now") creates its agent's task when one is
// needed; the agent's own cron decides when the task is picked up.
await boss.work<TaskScheduleJob>(TASK_SCHEDULE_QUEUE, (jobs) => logged(TASK_SCHEDULE_QUEUE, async () => {
  for (const job of jobs) {
    console.log(`task-schedule ${job.data.scheduleId}: ${await runScheduledTask(context, job.data.scheduleId)}`);
  }
}));

// "Continue with Claude" on a review page: the PR's review note, which the chat reads first.
await boss.work<ReviewNoteJob>(REVIEW_NOTE_QUEUE, (jobs) => logged(REVIEW_NOTE_QUEUE, async () => {
  for (const job of jobs) {
    console.log(`review-note: ${await writeReviewNote(db, await reviewBacklogRoot(job.data.prId), job.data.prId)}`);
  }
}));

// WWW records from the www.create command (e.g. the Finish dialog's "what went wrong"): one at a time into the vault's log.
await boss.work<WwwJob>(WWW_QUEUE, (jobs) => logged(WWW_QUEUE, async () => {
  for (const job of jobs) {
    console.log(`www: ${await writeWwwRecord(db, vaultsRoot(), job.data.recordId)}`);
  }
}));

// Settings → Add vault (user decision 2026-10-05): the folder and its root files, drafts and usage folders; nothing existing is touched.
await boss.work<VaultJob>(VAULT_INIT_QUEUE, (jobs) => logged(VAULT_INIT_QUEUE, async () => {
  for (const job of jobs) {
    const created = await initVault(`${vaultsRoot()}/${job.data.vault}`, vaultTemplateHome(), `${vaultsHostRoot()}/${job.data.vault}`);

    console.log(`vault-init ${job.data.vault}: ${created.length > 0 ? `created ${created.join(", ")}` : "nothing missing"}`);
  }
}));

// The Maintenance tab's Restore / Delete on a vault's .trash/ (user decision 2026-10-06).
await boss.work<VaultTrashJob>(VAULT_TRASH_QUEUE, (jobs) => logged(VAULT_TRASH_QUEUE, async () => {
  for (const job of jobs) {
    const root = `${vaultsRoot()}/${job.data.vault}`;
    const path = job.data.action === "restore" ? await restoreFromTrash(root, job.data.path) : await deleteFromTrash(root, job.data.path);

    console.log(`vault-trash ${job.data.vault}: ${job.data.action === "restore" ? "restored" : "deleted"} ${path}`);
  }
}));

console.log("worker started");

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

// "Sync PBI" brings any PBI, whatever its ADO state (user decision 2026-10-02).
async function runPbiJob(job: PbiJob): Promise<string> {
  if (job.action === "sync") {
    return syncOrThrow(job.adoId, job.vault);
  }

  if (job.action === "delete") {
    return deletePbi(context, job.adoId);
  }

  await refreshPbi(context, job.adoId);

  return `PBI-${job.adoId} refreshed`;
}

// A PBI adoa has stays in its vault; a new one joins the vault the user had selected.
async function syncOrThrow(adoId: number, selectedVault: string | undefined): Promise<string> {
  const vault = (await vaultOfPbi(db, adoId)) ?? selectedVault;

  if (!vault) {
    throw new Error(`PBI-${adoId}: no vault to sync it into`);
  }

  const synced = await syncOnePbi(context, adoId, false, vault);

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

// The review note goes into the backlog of the PR's vault.
async function reviewBacklogRoot(prId: number): Promise<string> {
  const [pr] = await db.select({ vault: pullRequest.vault }).from(pullRequest).where(eq(pullRequest.id, prId));

  if (!pr) {
    throw new Error(`PR ${prId} isn't in adoa`);
  }

  return vaultBacklogRoot(context.backlogMount, pr.vault);
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
