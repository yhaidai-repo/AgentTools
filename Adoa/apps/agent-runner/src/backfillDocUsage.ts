// One-off (user decision 2026-10-02): puts the doc reads of adoa's runs from before usage logging into VaultUsage's log,
// from the run traces (kept 30 days). A run already in the log is skipped, so it's safe to run again.
// Run in the agent-runner container: npm run backfill:doc-usage -w @adoa/agent-runner
import { DocUsageLog } from "@adoa/agents";
import { agentRun, createDb } from "@adoa/db";
import { PostgresUsageStore, type StoredTraceEvent } from "@agenttools/usage";
import { gte } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { requireEnv } from "./env";

const TRACE_DAYS = 30;

const { db, pool } = createDb(requireEnv("DATABASE_URL"));
const usageStore = new PostgresUsageStore(pool);
const logPath = `/vaults/${requireEnv("DOCS_VAULT_NAME")}/.usage/usage.jsonl`;
const log = new DocUsageLog(logPath);
const logged = await loggedRuns(logPath);
const since = new Date(Date.now() - TRACE_DAYS * 24 * 60 * 60 * 1000);
const runs = (await db.select({ id: agentRun.id, stage: agentRun.stage }).from(agentRun).where(gte(agentRun.startedAt, since))).filter((run) => !logged.has(`RUN-${run.id}`));
let reads = 0;

for (const run of runs) {
  reads += await backfillRun(run.id, run.stage);
}

console.log(`doc usage backfill: ${reads} read(s) from ${runs.length} run(s) not logged yet`);
await pool.end();

async function backfillRun(runId: number, agentId: string): Promise<number> {
  const docReads = (await usageStore.trace(String(runId))).filter(isDocRead);

  for (const event of docReads) {
    await log.record([docPath(event)], "read", agentId, runId, event.at);
  }

  return docReads.length;
}

function isDocRead(event: StoredTraceEvent): boolean {
  return event.type === "tool_call" && event.payload.name === "read_doc" && docPath(event) !== "";
}

function docPath(event: StoredTraceEvent): string {
  const input = event.payload.input as { path?: string } | undefined;

  return String(input?.path ?? "").replaceAll("\\", "/").replace(/^\.?\/+/, "");
}

// Sessions (RUN-n) adoa already wrote to the log.
async function loggedRuns(path: string): Promise<Set<string>> {
  const text = await readFile(path, "utf8").catch(() => "");
  const sessions = text.split("\n").filter((line) => line.includes("\"source\":\"adoa\"")).map((line) => (JSON.parse(line) as { session?: string }).session ?? "");

  return new Set(sessions);
}
