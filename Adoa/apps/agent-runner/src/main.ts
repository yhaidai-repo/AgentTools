import { AGENT_DEFAULTS, DocUsageLog, GLOBAL_DEFAULTS, clearReviewCheckouts, loadCaptureRules, recoverInterruptedRuns, runAgentTask, type AgentDeps } from "@adoa/agents";
import { AGENT_RUN_QUEUE, createWorkerBoss, ensureQueues, readAdoSettings, syncPipelineStatus, vaultBacklogRoot, vaultOfPbi, type AgentRunJob } from "@adoa/core";
import { ConfluenceClient } from "@adoa/confluence";
import { createDb, localItem } from "@adoa/db";
import { VaultCaptureCli, publishPbi } from "@adoa/notes";
import { VaultWriter } from "@adoa/vault";
import { PostgresAgentConfigStore } from "@agenttools/config";
import { ClaudeAgentSdkRuntime, RepoCache, RuntimeRegistry } from "@agenttools/runtime";
import { PostgresUsageStore, PriceBook } from "@agenttools/usage";
import { eq } from "drizzle-orm";
import { adoAuthHeader, docsExclude, requireEnv, skillFolders } from "./env";

const TRACE_RETENTION_DAYS = 30;
const REPO_REFRESH_MINUTES = 30;
const ACTOR = "agent-runner";

const databaseUrl = requireEnv("DATABASE_URL");
const { db, pool } = createDb(databaseUrl);
const boss = createWorkerBoss(databaseUrl);
const usageStore = new PostgresUsageStore(pool);
const config = new PostgresAgentConfigStore(pool);
// Every vault, writable (user decision 2026-10-03): a run reads and writes the vault of its task.
const vaultsRoot = requireEnv("VAULTS_DIR");
// adoa's backlog vault: each vault's rendered backlog is a folder in it (user decision 2026-10-05).
const backlogMount = requireEnv("BACKLOG_MOUNT");

boss.on("error", (error) => console.error("pg-boss:", error));

await boss.start();
await ensureQueues(boss);
await usageStore.ensureSchema();
await config.ensureSchema();
await config.ensureDefaults(AGENT_DEFAULTS, GLOBAL_DEFAULTS);
await recoverInterruptedRuns(db);

const repoCacheRoot = requireEnv("REPO_CACHE_ROOT");

await clearReviewCheckouts(repoCacheRoot);
const captureRules = await loadCaptureRules(process.env.VAULT_CAPTURE_HOME);

if (!captureRules) {
  console.error("VAULT_CAPTURE_HOME is not set: agents get no vault_capture tool");
}

// What every run shares; the vault-bound parts come from depsFor.
const shared = {
  db,
  config,
  runtimes: new RuntimeRegistry().register(new ClaudeAgentSdkRuntime()),
  usageStore,
  prices: new PriceBook(),
  docsExclude: docsExclude(),
  skillFolders: skillFolders(),
  repoCacheRoot,
  captureRules,
  vaults: { root: vaultsRoot, writer: (vault: string) => docsVaultOf(new VaultWriter(`${vaultsRoot}/${vault}`)) },
  confluence: ConfluenceClient.fromEnv(),
  confluenceSite: process.env.CONFLUENCE_SITE?.trim().replace(/\/+$/, "") || null,
};

// One task per job, one job at a time: the worker's dispatcher decides what runs and when (it owns the schedules).
await boss.work<AgentRunJob>(AGENT_RUN_QUEUE, (jobs) => logged(AGENT_RUN_QUEUE, async () => {
  for (const job of jobs) {
    await runAndPublish(job.data);
  }
}));

console.log(`agent-runner started; providers: ${shared.runtimes.providers().join(", ")}`);

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

// The Vault shows the task's outcome right away (user decision 2026-10-01: the runner writes the notes itself),
// also when the run failed.
async function runAndPublish(job: AgentRunJob): Promise<void> {
  await purgeOldTraces();

  const vault = await vaultOfJob(job);

  try {
    await runAgentTask(await depsFor(vault), job);
  } finally {
    await publishTaskPbi(vault, job.pbiId);
  }
}

// The run's vault: the task's PBI's, or the task's own (a tech-writer or vault-review task without a PBI).
async function vaultOfJob(job: AgentRunJob): Promise<string> {
  const [task] = await db.select({ vault: localItem.vault }).from(localItem).where(eq(localItem.id, job.taskId));

  if (!task) {
    throw new Error(`task ${job.taskId} isn't in adoa`);
  }

  return task.vault;
}

// The run reads docs from its vault, writes drafts, merges and the usage log into it, and reads the PBI note from the
// vault's backlog. VaultWriter keeps every path inside the vault; the tech-writer's tools refuse draft/ and root files.
async function depsFor(vault: string): Promise<AgentDeps> {
  const root = `${vaultsRoot}/${vault}`;

  return {
    ...shared,
    repoCache: await repoCacheOf(vault),
    docsRoot: root,
    vaultRoot: vaultBacklogRoot(backlogMount, vault),
    docsVault: docsVaultOf(new VaultWriter(root)),
    docsVaultName: vault,
    listRegister: async (project, kind) => (await VaultCaptureCli.forVault(vault, "the tech-writer lists a register")).listRegister(project, kind),
    docUsageLog: new DocUsageLog(`${root}/.usage/usage.jsonl`),
  };
}

// One cache per vault (it remembers when each repo was fetched), cloning with the vault's ADO token; the vault's local
// repos are plain paths under the repos mount and need no token.
const repoCaches = new Map<string, RepoCache>();

async function repoCacheOf(vault: string): Promise<RepoCache> {
  const cached = repoCaches.get(vault);

  if (cached) {
    return cached;
  }

  const pat = (await readAdoSettings(db, vault))?.pat ?? "";
  const cache = new RepoCache({ root: `${repoCacheRoot}/${vault}`, authHeader: adoAuthHeader(pat), refreshMinutes: REPO_REFRESH_MINUTES });

  repoCaches.set(vault, cache);

  return cache;
}

function docsVaultOf(writer: VaultWriter): NonNullable<AgentDeps["docsVault"]> {
  return {
    readNote: (path) => writer.readText(path),
    writeNote: async (path, content) => {
      await writer.writeText(path, content);
    },
    removeFile: (path) => writer.remove(path),
  };
}

// A task without a PBI (a chat draft's tech-writer task) has no PBI status or notes to update.
async function publishTaskPbi(vault: string, pbiId: number | null): Promise<void> {
  if (pbiId === null) {
    return;
  }

  await syncPipelineStatus(db, pbiId, ACTOR);
  await publishPbi(db, vaultBacklogRoot(backlogMount, (await vaultOfPbi(db, pbiId)) ?? vault), pbiId);
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
