// First import: @powerloom/agents patches dns.lookup, and imports run in order, so no client is created before it.
import { AGENT_DEFAULTS, AgentDepsFactory, GLOBAL_DEFAULTS, createAzureUserLogin, depsEnvFromProcess, requireEnv } from "@powerloom/agents";
import { createPowerLoomClient, createPowerLoomPort } from "@powerloom/client";
import { readVaults } from "@powerloom/core";
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
// The Azure MCP server's `az` shim asks this host for tokens; no agent runtime: the chat brings its own model.
const env = depsEnvFromProcess(`http://127.0.0.1:${port}`);
const azureLogin = createAzureUserLogin(db);
const deps = await AgentDepsFactory.create(db, pool, env, { azureLogin, runtimes: new RuntimeRegistry() });

await deps.ensureStores(AGENT_DEFAULTS, GLOBAL_DEFAULTS);

const sessions = new ChatSessions({
  db,
  deps,
  powerloom: createPowerLoomPort(createPowerLoomClient(env.powerloomUrl)),
  backlogMount: env.backlogMount,
  agents: deps.config,
  usage: deps.usageStore,
  // PowerLoom's own skills folder is the first one (SKILL_FOLDERS), the only one the commands may edit.
  skills: skillCatalogOf(env.skillFolders, env.skillFolders[0] ?? null),
});
const server = new McpHttpServer({ token, sessions, azureLogin, vaults: async () => (await readVaults(db)).map((vault) => vault.name) });
const sweep = setInterval(() => void sessions.closeIdle(IDLE_MINUTES * 60_000), SWEEP_MS);

server.listen(port);
console.log(`powerloom-mcp listening on :${port}`);

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

async function stop(): Promise<void> {
  clearInterval(sweep);
  await sessions.closeAll();
  await server.close();
  await pool.end();
  process.exit(0);
}
