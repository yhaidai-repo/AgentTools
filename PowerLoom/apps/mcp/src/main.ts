// First import: @powerloom/agents patches dns.lookup, and imports run in order, so no client is created before it.
import { AGENT_DEFAULTS, AgentDepsFactory, GLOBAL_DEFAULTS, closeOrphanedChatBrowser, createAzureUserLogin, depsEnvFromProcess, devHubsOfVaults, requireEnv, stopOrphanedChatStack } from "@powerloom/agents";
import { createPowerLoomClient, createPowerLoomPort } from "@powerloom/client";
import { captureConsoleErrors, readVaults, type HostFolder } from "@powerloom/core";
import { createDb } from "@powerloom/db";
import { RuntimeRegistry } from "@agenttools/runtime";
import { skillCatalogOf } from "@agenttools/runtime/skills";
import { ChatSessions } from "./ChatSessions";
import { McpHttpServer } from "./McpHttpServer";

// A session nobody called for this long is closed; the chat opens a new one with its next call.
const IDLE_MINUTES = Number(process.env.MCP_IDLE_MINUTES ?? "30");
const SWEEP_MS = 60_000;

const port = Number(process.env.MCP_PORT ?? "3110");
const token = requireEnv("MCP_TOKEN");
const { db, pool } = createDb(requireEnv("DATABASE_URL"));

// Warnings and errors also go to the error log, which chats read (logs_read) without Grafana.
captureConsoleErrors(db, "mcp");
// The Azure MCP server's `az` shim asks this host for tokens; no agent runtime: the chat brings its own model.
const env = depsEnvFromProcess(`http://127.0.0.1:${port}`);
const azureLogin = createAzureUserLogin(db);
// One Azure MCP server per vault, kept for all sessions: a session no longer starts its own (about a minute) before it can initialize.
const deps = await AgentDepsFactory.create(db, pool, env, { azureLogin, runtimes: new RuntimeRegistry(), shareAzureServers: true });

await deps.ensureStores(AGENT_DEFAULTS, GLOBAL_DEFAULTS);
await stopOrphanedChatStacks();

const sessions = new ChatSessions({
  db,
  deps,
  powerloom: createPowerLoomPort(createPowerLoomClient(env.powerloomUrl)),
  backlogMount: env.backlogMount,
  agents: deps.config,
  usage: deps.usageStore,
  hostFolders: hostFolders(),
  // PowerLoom's own skills folder is the first one (SKILL_FOLDERS), the only one the commands may edit.
  skills: skillCatalogOf(env.skillFolders, env.skillFolders[0] ?? null),
});
const server = new McpHttpServer({ token, sessions, azureLogin, azureTokenSecret: env.azureTokenSecret, vaults: async () => (await readVaults(db)).map((vault) => vault.name) });
deps.warmUpAzure((await readVaults(db)).map((vault) => vault.name));
const sweep = setInterval(() => void sessions.closeIdle(IDLE_MINUTES * 60_000), SWEEP_MS);

server.listen(port);
console.log(`powerloom-mcp listening on :${port}`);

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

// The vaults root and the repos folder as the PC names them (compose passes VAULTS_ROOT and REPOS_ROOT), where this
// container mounts them; a root that isn't set is left out, so its files can't be attached.
function hostFolders(): HostFolder[] {
  const folders = [
    { hostRoot: process.env.VAULTS_HOST_ROOT ?? "", mount: env.vaultsRoot },
    { hostRoot: process.env.REPOS_HOST_ROOT ?? "", mount: process.env.REPOS_MOUNT ?? "/repos" },
  ];

  return folders.filter((folder) => folder.hostRoot.trim().length > 0);
}

// No session survives a restart, so a stack or browser case a chat left behind is orphaned on every DevHub a vault
// points at (the agent-runner does the same for runs).
async function stopOrphanedChatStacks(): Promise<void> {
  for (const client of await devHubsOfVaults(db)) {
    logNote(await closeOrphanedChatBrowser(client));
    logNote(await stopOrphanedChatStack(client));
  }
}

function logNote(note: string | null): void {
  if (note) {
    console.log(note);
  }
}

async function stop(): Promise<void> {
  clearInterval(sweep);
  await sessions.closeAll();
  await deps.closeSharedAzure();
  await server.close();
  await pool.end();
  process.exit(0);
}
