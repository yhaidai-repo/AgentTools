import { AGENT_DEFAULTS, DocUsageLog, GLOBAL_DEFAULTS, clearReviewCheckouts, loadCaptureRules, recoverInterruptedRuns, runAgentTask, type AgentDeps } from "@adoa/agents";
import { AGENT_RUN_QUEUE, createWorkerBoss, ensureQueues, syncPipelineStatus, type AgentRunJob } from "@adoa/core";
import { ConfluenceClient } from "@adoa/confluence";
import { createDb } from "@adoa/db";
import { VaultCaptureCli, publishPbi } from "@adoa/notes";
import { VaultWriter, vaultsDir } from "@adoa/vault";
import { PostgresAgentConfigStore } from "@agenttools/config";
import { ClaudeAgentSdkRuntime, RepoCache, RuntimeRegistry } from "@agenttools/runtime";
import { PostgresUsageStore, PriceBook } from "@agenttools/usage";
import { adoAuthHeader, docsExclude, requireEnv, skillFolders } from "./env";

const TRACE_RETENTION_DAYS = 30;
const REPO_REFRESH_MINUTES = 30;
const ACTOR = "agent-runner";

const databaseUrl = requireEnv("DATABASE_URL");
const { db, pool } = createDb(databaseUrl);
const boss = createWorkerBoss(databaseUrl);
const usageStore = new PostgresUsageStore(pool);
const config = new PostgresAgentConfigStore(pool);
const vaultRoot = requireEnv("VAULT_ROOT");

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

const deps: AgentDeps = {
  db,
  config,
  runtimes: new RuntimeRegistry().register(new ClaudeAgentSdkRuntime()),
  usageStore,
  prices: new PriceBook(),
  docsRoot: requireEnv("DOCS_ROOT"),
  docsExclude: docsExclude(),
  vaultRoot,
  skillFolders: skillFolders(),
  repoCache: new RepoCache({ root: repoCacheRoot, authHeader: adoAuthHeader(), refreshMinutes: REPO_REFRESH_MINUTES }),
  repoCacheRoot,
  captureRules,
  docsVault: docsVaultWriter(),
  docsVaultName: process.env.DOCS_VAULT_NAME?.trim() || null,
  vaults: vaultsAccess(),
  listRegister: async (project, kind) => (await VaultCaptureCli.fromEnv("the tech-writer lists a register")).listRegister(project, kind),
  confluence: ConfluenceClient.fromEnv(),
  confluenceSite: process.env.CONFLUENCE_SITE?.trim().replace(/\/+$/, "") || null,
  docUsageLog: docUsageLog(),
};

// One task per job, one job at a time: the worker's dispatcher decides what runs and when (it owns the schedules).
await boss.work<AgentRunJob>(AGENT_RUN_QUEUE, (jobs) => logged(AGENT_RUN_QUEUE, async () => {
  for (const job of jobs) {
    await runAndPublish(job.data);
  }
}));

console.log(`agent-runner started; providers: ${deps.runtimes.providers().join(", ")}`);

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

// The Vault shows the task's outcome right away (user decision 2026-10-01: the runner writes the notes itself),
// also when the run failed.
async function runAndPublish(job: AgentRunJob): Promise<void> {
  await purgeOldTraces();

  try {
    await runAgentTask(deps, job);
  } finally {
    await publishTaskPbi(job.pbiId);
  }
}

// The docs vault the tech-writer merges drafts into (mounted writable; VaultWriter keeps every path inside it and the
// tech-writer's tools refuse draft/ and root files).
function docsVaultWriter(): AgentDeps["docsVault"] {
  const vaultName = process.env.DOCS_VAULT_NAME;

  if (!vaultName) {
    return null;
  }

  return docsVaultOf(new VaultWriter(`/vaults/${vaultName}`));
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

// Every vault under the vaults root, writable (user decision 2026-10-03): the vault review's link fixes and removals, the
// tech-writer's actualize tasks. VaultWriter keeps every path inside its vault.
function vaultsAccess(): AgentDeps["vaults"] {
  const root = vaultsDir();

  return root ? { root, writer: (vault) => docsVaultOf(new VaultWriter(`${root}/${vault}`)) } : null;
}

// VaultUsage's log in the writable docs vault mount (same place as the tech-writer's merges).
function docUsageLog(): DocUsageLog | null {
  const vaultName = process.env.DOCS_VAULT_NAME;

  return vaultName ? new DocUsageLog(`/vaults/${vaultName}/.usage/usage.jsonl`) : null;
}

// A task without a PBI (a chat draft's tech-writer task) has no PBI status or notes to update.
async function publishTaskPbi(pbiId: number | null): Promise<void> {
  if (pbiId === null) {
    return;
  }

  await syncPipelineStatus(db, pbiId, ACTOR);
  await publishPbi(db, vaultRoot, pbiId);
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
