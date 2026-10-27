import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { Pool } from "pg";
import { BudgetGuard } from "./BudgetGuard";
import { PriceBook } from "./PriceBook";
import type { UsageStore } from "./models/UsageStore";
import { JsonlUsageStore } from "./stores/JsonlUsageStore";
import { PostgresUsageStore } from "./stores/PostgresUsageStore";
import { UsageTracker } from "./UsageTracker";

async function checkIncomplete(store: UsageStore, scope: string): Promise<void> {
  const tracker = new UsageTracker(`incomplete-${scope}`, { scope }, new PriceBook());
  const record = tracker.finish({ outcome: "failed", turns: 2, usageComplete: false });
  assert.equal(record.costUsd, 0);
  assert.equal(record.accountingComplete, false);
  await store.saveRecord(record);
  const guard = new BudgetGuard({ perRunUsd: null, daily: [{ match: { scope }, limitUsd: 10 }] }, store);
  const decision = await guard.canStart({ scope });
  assert.equal(decision.allowed, false);
  assert.match(decision.reason!, /accounting is incomplete/);
  const query = { from: new Date(0), match: { scope } };
  assert.equal((await store.records(query, 10))[0].accountingComplete, false);
  assert.equal((await store.totals(query, "scope"))[0].accountingComplete, false);
  const unrelated = new BudgetGuard({ perRunUsd: null, daily: [{ match: { scope: "other" }, limitUsd: 10 }] }, store);
  assert.equal((await unrelated.canStart({ scope: "other" })).allowed, true);
}

it("persists incomplete usage and refuses matching JSONL daily budgets instead of charging zero", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "usage-accounting-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await checkIncomplete(new JsonlUsageStore(folder), randomUUID());
});

it("keeps measured normal accounting available for successful runs", () => {
  const tracker = new UsageTracker("measured", {}, new PriceBook());
  tracker.add({ runId: "measured", model: "gpt-6.1-sol", inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 });
  const record = tracker.finish({ outcome: "success", turns: 1, usageComplete: true });
  assert.equal(record.accountingComplete, true);
  assert.ok(record.costUsd > 0);
});

const databaseUrl = process.env.AGENT_USAGE_TEST_DATABASE_URL;
it("persists incomplete accounting through PostgreSQL and refuses matching daily budgets", { skip: !databaseUrl }, async () => {
  assert.equal(new URL(databaseUrl!).hostname, "127.0.0.1");
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresUsageStore(pool);
  const scope = randomUUID();
  try {
    await store.ensureSchema();
    await store.ensureSchema();
    await checkIncomplete(store, scope);
  } finally {
    await pool.query("DELETE FROM agent_usage.usage_record WHERE run_id = $1", [`incomplete-${scope}`]).finally(() => pool.end());
  }
});
