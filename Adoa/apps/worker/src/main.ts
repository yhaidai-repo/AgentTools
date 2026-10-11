import { DISPATCH_QUEUE, PBI_QUEUE, applyDispatchTick, saveConfluenceStatus, createWorkerBoss, ensureQueues, type DispatchJob, type PbiJob } from "@adoa/core";
import { ConfluenceClient } from "@adoa/confluence";
import { createDb, pullRequest } from "@adoa/db";
import { eq } from "drizzle-orm";
import { PostgresAgentConfigStore } from "@agenttools/config";
import { backlogMount, legacyBacklogFolder, requireEnv, vaultTemplateHome, vaultsHostRoot, vaultsRoot } from "./env";
import { migrateLegacyBacklog } from "./backlog/migrateLegacyBacklog";
import type { WorkerContext } from "./models/WorkerContext";
import { refreshPbi, refreshQueuedPbis } from "./refreshPbi";
import { seedAdoSettingsFromEnv } from "./seedSettings";

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
await applyDispatchTick(boss);

// Every message: the PBIs referenced by queued agent tasks are brought up to date (statuses, Vault). The agents, their
// documents, drafts and bugs are PowerLoom's (the vault's adoa-backend-delivery note).
await boss.work<DispatchJob>(DISPATCH_QUEUE, (jobs) => logged(DISPATCH_QUEUE, async () => {
  for (const job of jobs) {
    await dispatch(job.data);
  }
}));

// The refresh after an item changes.
await boss.work<PbiJob>(PBI_QUEUE, (jobs) => logged(PBI_QUEUE, async () => {
  for (const job of jobs) {
    console.log(`pbi: ${await runPbiJob(job.data)}`);
  }
}));

console.log("worker started");

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

async function runPbiJob(job: PbiJob): Promise<string> {
  await refreshPbi(context, job.adoId);

  return `PBI-${job.adoId} refreshed`;
}

async function dispatch(job: DispatchJob): Promise<void> {
  await refreshQueuedPbis(context, job.agentId);
}

// The review note goes into the backlog of the PR's vault.

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
