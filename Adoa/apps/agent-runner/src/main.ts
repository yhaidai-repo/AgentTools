import { runRefinementBatch, type RefinementBatchDeps } from "@adoa/agents";
import {
  REFINEMENT_QUEUE,
  RENDER_QUEUE,
  applyRefinementSchedule,
  createWorkerBoss,
  ensureQueues,
  readAgentSettings,
  type RenderJob,
} from "@adoa/core";
import { createDb } from "@adoa/db";
import { ClaudeAgentSdkRuntime } from "@agenttools/runtime";
import { PostgresUsageStore, PriceBook } from "@agenttools/usage";
import { docsExclude, requireEnv, skillFolders } from "./env";

const TRACE_RETENTION_DAYS = 30;

const databaseUrl = requireEnv("DATABASE_URL");
const { db, pool } = createDb(databaseUrl);
const boss = createWorkerBoss(databaseUrl);
const usageStore = new PostgresUsageStore(pool);

boss.on("error", (error) => console.error("pg-boss:", error));

await boss.start();
await ensureQueues(boss);
await usageStore.ensureSchema();

const settings = await readAgentSettings(db);
const deps: RefinementBatchDeps = {
  db,
  runtime: new ClaudeAgentSdkRuntime(),
  usageStore,
  prices: new PriceBook(),
  docsRoot: requireEnv("DOCS_ROOT"),
  docsExclude: docsExclude(),
  vaultRoot: requireEnv("VAULT_ROOT"),
  skillFolders: skillFolders(),
  enqueueRender: async (adoId) => {
    const job: RenderJob = { adoId };

    await boss.send(RENDER_QUEUE, job);
  },
};

await applyRefinementSchedule(boss, settings.refinement.cron, settings.refinement.enabled);
await boss.work(REFINEMENT_QUEUE, async () => {
  await purgeOldTraces();
  console.log(`refinement batch: ${await runRefinementBatch(deps)}`);
});

console.log("agent-runner started");

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

async function purgeOldTraces(): Promise<void> {
  const cutoff = new Date(Date.now() - TRACE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await usageStore.purgeTraceBefore(cutoff);
}

async function stop(): Promise<void> {
  await boss.stop();
  await pool.end();
  process.exit(0);
}
