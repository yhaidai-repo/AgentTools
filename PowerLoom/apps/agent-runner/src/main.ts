// First import: @powerloom/agents patches dns.lookup, and imports run in order, so no client is created before it.
import { AGENT_DEFAULTS, AgentDepsFactory, CodexDeviceLogin, CodexHome, GLOBAL_DEFAULTS, clearReviewCheckouts, closeOrphanedBrowser, closeRunBrowser, createAzureUserLogin, depsEnvFromProcess, devHubsOfVaults, recoverInterruptedRuns, requireEnv, runAgentTask, spawnCodexLogin, stopOrphanedStack, stopRunStack, type AgentDeps } from "@powerloom/agents";
import { saveClaudeEnvTokenReport, type AgentRunJob } from "@powerloom/core";
import { OUTSIDE_KINDS, createDb, dataAccess, localItem } from "@powerloom/db";
import { DevHubClient, checkDevHub } from "@powerloom/devhub";
import { SqlReader } from "@powerloom/sql";
import { ClaudeAgentSdkRuntime, CodexSdkRuntime, RuntimeRegistry } from "@agenttools/runtime";
import { and, eq, lt, notInArray } from "drizzle-orm";
import { PowerLoomCallback, type CompletedRun } from "./powerloomCallback";
import { RunnerServer } from "./runnerServer";

const TRACE_RETENTION_DAYS = 30;
// The data access log outlives the traces (user decision 2026-10-13: every outside read traceable); counts only, no data.
const DATA_ACCESS_RETENTION_DAYS = Number(process.env.DATA_ACCESS_RETENTION_DAYS ?? "365");
// Every other tool call (repos, docs, web, PowerLoom's own tools) is the bulk of the log and matters for less long.
const TOOL_CALL_RETENTION_DAYS = Number(process.env.TOOL_CALL_RETENTION_DAYS ?? "90");
const INTERRUPTED: CompletedRun = { runId: null, outcome: "aborted", error: "the agent-runner stopped during the run" };

const { db, pool } = createDb(requireEnv("DATABASE_URL"));
// One task at a time: PowerLoom's dispatcher decides what runs and when (it owns the schedules).
const runnerPort = Number(process.env.RUNNER_PORT ?? "3200");
// The Azure MCP server's `az` shim asks this runner for tokens.
const env = depsEnvFromProcess(`http://127.0.0.1:${runnerPort}`);
// Claude's transcripts are kept only where CLAUDE_CONFIG_DIR is set to a volume (compose), so a task's next run can
// continue a run that didn't finish, even after a restart (user decision 2026-10-19).
const keepConversations = Boolean(process.env.CLAUDE_CONFIG_DIR);
const runtimes = new RuntimeRegistry().register(new ClaudeAgentSdkRuntime(keepConversations));
// Codex signs in to PowerLoom's own home (PowerLoom/agent-homes/codex, mounted at CODEX_HOME; never the user's ~/.codex).
// It is always registered when the home is there: the connected check before a run decides whether it may run.
const codexHome = process.env.CODEX_HOME ? new CodexHome(process.env.CODEX_HOME) : null;

if (codexHome) {
  runtimes.register(new CodexSdkRuntime({ keepConversations: true, codexHome: codexHome.path }));
}

const codex = codexHome ? { home: codexHome, login: new CodexDeviceLogin(codexHome, { spawn: spawnCodexLogin }) } : null;
const azureLogin = createAzureUserLogin(db);
const deps = await AgentDepsFactory.create(db, pool, env, { azureLogin, runtimes });

// PowerLoom dispatches the tasks and takes the one callback per run (the vault's adoa-backend-delivery note, phase 5).
const powerloom = new PowerLoomCallback(env.powerloomUrl);

await deps.ensureStores(AGENT_DEFAULTS, GLOBAL_DEFAULTS);
// Settings → AI providers shows Claude as connected through .env while no token is saved there; the token stays here.
await saveClaudeEnvTokenReport(db, Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN));

for (const taskId of await recoverInterruptedRuns(db)) {
  await report(taskId, INTERRUPTED);
}

await stopOrphanedStacks();
await clearReviewCheckouts(env.repoCacheRoot);

const sqlReader = new SqlReader();
const server = new RunnerServer(runAndReport, (connectionString) => sqlReader.check(connectionString), (url, token) => checkDevHub(new DevHubClient(url, token)), azureLogin, codex);

server.listen(runnerPort);
console.log(`agent-runner started; providers: ${runtimes.providers().join(", ")}`);

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

// Every run ends with the callback, also a failed one and a task the runner refused: PowerLoom waits for it.
async function runAndReport(job: AgentRunJob): Promise<void> {
  await purgeOldTraces();

  let completed: CompletedRun = { runId: null, outcome: "aborted", error: "the task was not started (its held reasons say why)" };
  let devHub: AgentDeps["devHub"] = null;
  let azure: AgentDeps["azure"] = null;

  try {
    const runDeps = await deps.forVault(await vaultOfJob(job));

    devHub = runDeps.devHub;
    azure = runDeps.azure;

    const result = await runAgentTask(runDeps, job);

    completed = result ? { runId: result.runId, outcome: result.outcome, error: result.error ?? null } : completed;
  } catch (error) {
    console.error(`${job.agentId} ${job.taskId} failed:`, error);
    completed = { runId: null, outcome: "failed", error: String(error) };
  } finally {
    await stopStackOfRun(devHub, completed.runId);
    await deps.closeAzure(azure);
    await report(job.taskId, completed);
  }
}

// Before the callback, so the next task never finds this run's stack still running; DevHub's own clock stops it
// when this is skipped (a crash) and the next start sweeps it.
async function stopStackOfRun(access: AgentDeps["devHub"], runId: number | null): Promise<void> {
  if (!access || runId === null) {
    return;
  }

  logStackNote(await closeRunBrowser(access.client, runId));
  logStackNote(await stopRunStack(access.client, runId));
}

// At start no run is in progress: a stack a run left behind (the runner stopped mid-run) is stopped on every DevHub a
// vault points at.
async function stopOrphanedStacks(): Promise<void> {
  for (const client of await devHubsOfVaults(db)) {
    logStackNote(await closeOrphanedBrowser(client));
    logStackNote(await stopOrphanedStack(client));
  }
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

async function purgeOldTraces(): Promise<void> {
  await deps.usageStore.purgeTraceBefore(daysAgo(TRACE_RETENTION_DAYS));
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
