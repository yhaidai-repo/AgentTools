// First import: it patches dns.lookup, and imports run in order, so no client is created before it.
import "./preferIpv4";
import { AdoClient } from "@powerloom/ado";
import { AGENT_DEFAULTS, AZURE_ACCESS_NAMESPACES, AccessRequests, COSMOS_NAMESPACE, DataAccessLog, DocUsageLog, GLOBAL_DEFAULTS, clearReviewCheckouts, loadCaptureRules, recoverInterruptedRuns, runAgentTask, stopOrphanedStack, stopRunStack, type AgentDeps } from "@powerloom/agents";
import { AZURE_USER_KEY, AZURE_USER_TOKEN_CACHE_KEY, isAdoActive, readAdoSettings, readAzureUserAccount, readDevHubSettings, readReadAzureSettings, readReadSqlSettings, readValue, readVaults, saveValue, vaultBacklogRoot, vaultSettingKey, type AgentRunJob } from "@powerloom/core";
import { ConfluenceClient } from "@powerloom/confluence";
import { OUTSIDE_KINDS, createDb, dataAccess, localItem } from "@powerloom/db";
import { AzureMcpServer, AzureUserLogin, CosmosConnectionStrings, ServiceBusPeeker } from "@powerloom/azure";
import { MongoReader } from "@powerloom/mongo";
import { DevHubClient, checkDevHub } from "@powerloom/devhub";
import { VaultCaptureCli } from "@powerloom/notes";
import { SqlReader } from "@powerloom/sql";
import { VaultWriter } from "@powerloom/vault";
import { PostgresAgentConfigStore } from "@agenttools/config";
import { ClaudeAgentSdkRuntime, RepoCache, RuntimeRegistry } from "@agenttools/runtime";
import { PostgresUsageStore, PriceBook } from "@agenttools/usage";
import { and, eq, lt, notInArray } from "drizzle-orm";
import { adoAuthHeader, docsExclude, requireEnv, skillFolders } from "./env";
import { PowerLoomCallback, type CompletedRun } from "./powerloomCallback";
import { RunnerServer } from "./runnerServer";

const TRACE_RETENTION_DAYS = 30;
// The data access log outlives the traces (user decision 2026-10-13: every outside read traceable); counts only, no data.
const DATA_ACCESS_RETENTION_DAYS = Number(process.env.DATA_ACCESS_RETENTION_DAYS ?? "365");
// Every other tool call (repos, docs, web, PowerLoom's own tools) is the bulk of the log and matters for less long.
const TOOL_CALL_RETENTION_DAYS = Number(process.env.TOOL_CALL_RETENTION_DAYS ?? "90");
const REPO_REFRESH_MINUTES = 30;
const INTERRUPTED: CompletedRun = { runId: null, outcome: "aborted", error: "the agent-runner stopped during the run" };

const databaseUrl = requireEnv("DATABASE_URL");
const { db, pool } = createDb(databaseUrl);
const usageStore = new PostgresUsageStore(pool);
const config = new PostgresAgentConfigStore(pool);
// Every vault, writable (user decision 2026-10-03): a run reads and writes the vault of its task.
const vaultsRoot = requireEnv("VAULTS_DIR");
// PowerLoom's backlog vault: each vault's rendered backlog is a folder in it (user decision 2026-10-05).
const backlogMount = requireEnv("BACKLOG_MOUNT");

// PowerLoom dispatches the tasks and takes the one callback per run (the vault's adoa-backend-delivery note, phase 5).
const powerloom = new PowerLoomCallback(requireEnv("POWERLOOM_URL").replace(/\/+$/, ""));

await usageStore.ensureSchema();
await config.ensureSchema();
await config.ensureDefaults(AGENT_DEFAULTS, GLOBAL_DEFAULTS);

for (const taskId of await recoverInterruptedRuns(db)) {
  await report(taskId, INTERRUPTED);
}

await stopOrphanedStacks();

const repoCacheRoot = requireEnv("REPO_CACHE_ROOT");

await clearReviewCheckouts(repoCacheRoot);
const captureRules = await loadCaptureRules(process.env.VAULT_CAPTURE_HOME);

if (!captureRules) {
  console.error("VAULT_CAPTURE_HOME is not set: agents get no vault_capture tool");
}

const sqlReader = new SqlReader();
const mongoReader = new MongoReader();

// The user's own sign-in for Azure (user decisions 2026-10-13/14): the MSAL cache and the account live in the config
// table per vault, the only settings the runner writes. The cache text is wrapped in an object: the Postgres driver
// sends a bare string into the jsonb column as JSON, and MSAL's JSON text would come back parsed.
const azureLogin = new AzureUserLogin({
  read: async (vault) => (await readValue<{ msal: string }>(db, vaultSettingKey(vault, AZURE_USER_TOKEN_CACHE_KEY)))?.msal ?? null,
  write: (vault, cache) => saveValue(db, vaultSettingKey(vault, AZURE_USER_TOKEN_CACHE_KEY), { msal: cache }),
  clear: (vault) => saveValue(db, vaultSettingKey(vault, AZURE_USER_TOKEN_CACHE_KEY), null),
  saveAccount: (vault, account) => saveValue(db, vaultSettingKey(vault, AZURE_USER_KEY), account),
});

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
  accessLog: new DataAccessLog(db),
  outside: { log: new DataAccessLog(db), requests: new AccessRequests(db) },
  confluence: ConfluenceClient.fromEnv(),
  confluenceSite: process.env.CONFLUENCE_SITE?.trim().replace(/\/+$/, "") || null,
};

// One task at a time: PowerLoom's dispatcher decides what runs and when (it owns the schedules).
const runnerPort = Number(process.env.RUNNER_PORT ?? "3200");
const server = new RunnerServer(runAndReport, (connectionString) => sqlReader.check(connectionString), (url, token) => checkDevHub(new DevHubClient(url, token)), azureLogin);

server.listen(runnerPort);
console.log(`agent-runner started; providers: ${shared.runtimes.providers().join(", ")}`);

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

// Every run ends with the callback, also a failed one and a task the runner refused: PowerLoom waits for it.
async function runAndReport(job: AgentRunJob): Promise<void> {
  await purgeOldTraces();

  let completed: CompletedRun = { runId: null, outcome: "aborted", error: "the task was not started (its held reasons say why)" };
  let devHub: AgentDeps["devHub"] = null;
  let azure: AgentDeps["azure"] = null;

  try {
    const deps = await depsFor(await vaultOfJob(job));

    devHub = deps.devHub;
    azure = deps.azure;

    const result = await runAgentTask(deps, job);

    completed = result ? { runId: result.runId, outcome: result.outcome, error: result.error ?? null } : completed;
  } catch (error) {
    console.error(`${job.agentId} ${job.taskId} failed:`, error);
    completed = { runId: null, outcome: "failed", error: String(error) };
  } finally {
    await stopStackOfRun(devHub, completed.runId);
    await closeAzure(azure);
    await report(job.taskId, completed);
  }
}

// Before the callback, so the next task never finds this run's stack still running; DevHub's own clock stops it
// when this is skipped (a crash) and the next start sweeps it.
async function stopStackOfRun(access: AgentDeps["devHub"], runId: number | null): Promise<void> {
  if (!access || runId === null) {
    return;
  }

  logStackNote(await stopRunStack(access.client, runId));
}

// At start no run is in progress: a stack a run left behind (the runner stopped mid-run) is stopped on every DevHub a
// vault points at.
async function stopOrphanedStacks(): Promise<void> {
  for (const client of await devHubsOfVaults()) {
    logStackNote(await stopOrphanedStack(client));
  }
}

async function devHubsOfVaults(): Promise<DevHubClient[]> {
  const settings = await Promise.all((await readVaults(db)).map((vault) => readDevHubSettings(db, vault.name)));
  const devHubs = new Map(settings.filter((stack) => stack.enabled && stack.token).map((stack) => [`${stack.url} ${stack.token}`, stack]));

  return [...devHubs.values()].map((stack) => new DevHubClient(stack.url, stack.token));
}

function logStackNote(note: string | null): void {
  if (note) {
    console.log(note);
  }
}

// A callback PowerLoom can't take is logged, not thrown: the run itself is already recorded.
async function report(taskId: string, completed: CompletedRun): Promise<void> {
  try {
    await powerloom.completed(taskId, completed);
  } catch (error) {
    console.error(`${taskId}: reporting the completed run to PowerLoom failed:`, error);
  }
}

// The run's vault: the task's PBI's, or the task's own (a tech-writer or vault-review task without a PBI).
async function vaultOfJob(job: AgentRunJob): Promise<string> {
  const [task] = await db.select({ vault: localItem.vault }).from(localItem).where(eq(localItem.id, job.taskId));

  if (!task) {
    throw new Error(`task ${job.taskId} isn't in PowerLoom`);
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
    sql: await sqlAccessOf(vault),
    azure: await azureAccessOf(vault),
    devHub: await devHubAccessOf(vault),
    ado: await adoAccessOf(vault),
  };
}

// Read per run, so a switch flipped in Settings counts from the next run. The Azure MCP server runs for the run with
// the vault's sign-in: its `az` shim asks this runner for tokens (POWERLOOM_RUNNER_URL, the vault), the tenant is the
// signed-in account's. The Mongo reads take the same sign-in's tokens; the Service Bus peeks use each namespace's own
// connection string from Settings. Nobody signed in =
// every call answers `denied`, which asks the user to sign in.
async function azureAccessOf(vault: string): Promise<AgentDeps["azure"]> {
  const settings = await readReadAzureSettings(db, vault);
  const namespaces = [...(settings.enabledKinds.azureAccess ? AZURE_ACCESS_NAMESPACES : []), ...(settings.enabledKinds.cosmos ? [COSMOS_NAMESPACE] : [])];
  const mongoOn = settings.enabledKinds.mongo === true;
  const serviceBusOn = settings.enabledKinds.serviceBus === true;

  if (namespaces.length === 0 && !mongoOn && !serviceBusOn) {
    return null;
  }

  const account = await readAzureUserAccount(db, vault);
  const env = { POWERLOOM_RUNNER_URL: `http://127.0.0.1:${runnerPort}`, POWERLOOM_AZURE_VAULT: vault, AZURE_TOKEN_CREDENTIALS: "AzureCliCredential", AZURE_TENANT_ID: account?.tenantId ?? "", AZURE_SUBSCRIPTION_ID: settings.subscription };
  const token = (resource: string) => azureLogin.token(vault, resource, account?.tenantId ?? null);

  return {
    settings,
    server: namespaces.length > 0 ? await AzureMcpServer.start({ namespaces, env: withoutEmpty(env) }) : null,
    serviceBus: serviceBusOn ? { peeker: new ServiceBusPeeker() } : null,
    mongo: mongoOn ? { reader: mongoReader, connectionStrings: new CosmosConnectionStrings(token, settings.subscription) } : null,
  };
}

// The run's server process ends with the run; a close that fails is logged, the run's outcome stands.
async function closeAzure(azure: AgentDeps["azure"]): Promise<void> {
  try {
    await azure?.server?.close();
  } catch (error) {
    console.error("the Azure MCP server did not close:", error);
  }
}

function withoutEmpty(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value.length > 0));
}

// Read per run, so a switch flipped in Settings counts from the next run. Without a token DevHub refuses every
// call, so the tools stay away until the vault has one.
async function devHubAccessOf(vault: string): Promise<AgentDeps["devHub"]> {
  const settings = await readDevHubSettings(db, vault);

  return settings.enabled && settings.token ? { client: new DevHubClient(settings.url, settings.token), url: settings.url } : null;
}

// Read per run, so a switch flipped in Settings counts from the next run: the vault's Azure DevOps, read only.
async function adoAccessOf(vault: string): Promise<AgentDeps["ado"]> {
  const settings = await readAdoSettings(db, vault);

  return isAdoActive(settings) ? { client: new AdoClient({ orgUrl: settings.orgUrl, project: settings.project, team: settings.team, pat: settings.pat }), orgUrl: settings.orgUrl } : null;
}

// Read per run, so a switch flipped in Settings counts from the next run.
async function sqlAccessOf(vault: string): Promise<AgentDeps["sql"]> {
  const settings = await readReadSqlSettings(db, vault);
  const connections = settings.connections.filter((connection) => connection.enabled);

  return settings.enabled && connections.length > 0 ? { reader: sqlReader, connections } : null;
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

async function purgeOldTraces(): Promise<void> {
  await usageStore.purgeTraceBefore(daysAgo(TRACE_RETENTION_DAYS));
  await db.delete(dataAccess).where(lt(dataAccess.startedAt, daysAgo(DATA_ACCESS_RETENTION_DAYS)));
  await db.delete(dataAccess).where(and(notInArray(dataAccess.kind, OUTSIDE_KINDS), lt(dataAccess.startedAt, daysAgo(TOOL_CALL_RETENTION_DAYS))));
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function stop(): Promise<void> {
  await server.close();
  await pool.end();
  process.exit(0);
}
