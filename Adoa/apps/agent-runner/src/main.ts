import { AGENT_DEFAULTS, GLOBAL_DEFAULTS, recoverInterruptedRuns, runRefinementBatch, runResearchBatch, type AgentDeps } from "@adoa/agents";
import { RENDER_QUEUE, applyAgentSchedule, createWorkerBoss, ensureQueues, type RenderJob } from "@adoa/core";
import { createDb } from "@adoa/db";
import { PostgresAgentConfigStore, type AgentConfigStore } from "@agenttools/config";
import { ClaudeAgentSdkRuntime, RepoCache, RuntimeRegistry } from "@agenttools/runtime";
import { PostgresUsageStore, PriceBook } from "@agenttools/usage";
import type { PgBoss } from "pg-boss";
import { adoAuthHeader, docsExclude, requireEnv, skillFolders } from "./env";

const TRACE_RETENTION_DAYS = 30;
const REPO_REFRESH_MINUTES = 30;

// Each agent's batch job; the queue name is the agent id from AgentConfig.
const BATCHES: Record<string, (deps: AgentDeps) => Promise<string>> = {
  refinement: runRefinementBatch,
  research: runResearchBatch,
};

const databaseUrl = requireEnv("DATABASE_URL");
const { db, pool } = createDb(databaseUrl);
const boss = createWorkerBoss(databaseUrl);
const usageStore = new PostgresUsageStore(pool);
const config = new PostgresAgentConfigStore(pool);

boss.on("error", (error) => console.error("pg-boss:", error));

await boss.start();
await ensureQueues(boss);
await usageStore.ensureSchema();
await config.ensureSchema();
await config.ensureDefaults(AGENT_DEFAULTS, GLOBAL_DEFAULTS);
await recoverInterruptedRuns(db);

const repoCacheRoot = requireEnv("REPO_CACHE_ROOT");
const deps: AgentDeps = {
  db,
  config,
  runtimes: new RuntimeRegistry().register(new ClaudeAgentSdkRuntime()),
  usageStore,
  prices: new PriceBook(),
  docsRoot: requireEnv("DOCS_ROOT"),
  docsExclude: docsExclude(),
  vaultRoot: requireEnv("VAULT_ROOT"),
  skillFolders: skillFolders(),
  repoCache: new RepoCache({ root: repoCacheRoot, authHeader: adoAuthHeader(), refreshMinutes: REPO_REFRESH_MINUTES }),
  repoCacheRoot,
  enqueueRender: async (adoId) => {
    const job: RenderJob = { adoId };

    await boss.send(RENDER_QUEUE, job);
  },
};

await applySchedules(boss, config);
await config.onChange(() => {
  applySchedules(boss, config).catch((error) => console.error("applying schedules after a config change failed:", error));
});

for (const [agentId, runBatch] of Object.entries(BATCHES)) {
  await boss.work(agentId, () => logged(agentId, async () => {
    await purgeOldTraces();
    console.log(`${agentId} batch: ${await runBatch(deps)}`);
  }));
}

console.log(`agent-runner started; providers: ${deps.runtimes.providers().join(", ")}`);

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

// Config is the source of truth for schedules; any client's change is applied here.
async function applySchedules(target: PgBoss, store: AgentConfigStore): Promise<void> {
  const agents = await store.list();

  for (const agent of agents) {
    await applyAgentSchedule(target, agent.id, agent.schedule, agent.enabled);
  }

  console.log(`schedules applied: ${agents.map((agent) => `${agent.id}=${agent.enabled ? agent.schedule : "off"}`).join(", ")}`);
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

async function purgeOldTraces(): Promise<void> {
  const cutoff = new Date(Date.now() - TRACE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await usageStore.purgeTraceBefore(cutoff);
}

async function stop(): Promise<void> {
  await boss.stop();
  await pool.end();
  process.exit(0);
}
