// One-off (user decision 2026-10-02): puts the doc reads of PowerLoom's runs from before usage logging into VaultUsage's log,
// from the run traces (kept 30 days). A run already in the log is skipped, so it's safe to run again.
// Run in the agent-runner container, for one vault: npm run backfill:doc-usage -w @powerloom/agent-runner -- <vault>
import { createDb } from "@powerloom/db";
import { PostgresUsageStore } from "@agenttools/usage";
import { requireEnv } from "@powerloom/agents";
import { backfillDocUsage } from "./docUsageBackfill";

const { db, pool } = createDb(requireEnv("DATABASE_URL"));
const usageStore = new PostgresUsageStore(pool);
const vault = process.argv[2];

if (!vault) {
  throw new Error("name the vault: npm run backfill:doc-usage -w @powerloom/agent-runner -- <vault>");
}

try {
  const result = await backfillDocUsage(db, usageStore, vault);
  console.log(`doc usage backfill: ${result.reads} read(s) from ${result.runs} run(s) not logged yet`);
} finally {
  await pool.end();
}
