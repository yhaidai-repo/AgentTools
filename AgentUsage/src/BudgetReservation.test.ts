import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Pool } from "pg";
import { budgetCost } from "./budgetCost";
import { BudgetGuard } from "./BudgetGuard";
import { UsageTracker } from "./UsageTracker";
import { PriceBook } from "./PriceBook";
import { JsonlUsageStore } from "./stores/JsonlUsageStore";
import { PostgresUsageStore } from "./stores/PostgresUsageStore";
import type { UsageStore } from "./models/UsageStore";

test("requires a finite positive reservation covering the known charge", () => {
  for (const budgetReservationUsd of [undefined, null, 0, -1, 5, NaN, Infinity]) {
    assert.throws(() => budgetCost({ costUsd: 6, accountingComplete: false, budgetReservationUsd }), /accounting is incomplete/);
  }
  assert.equal(budgetCost({ costUsd: 6, accountingComplete: false, budgetReservationUsd: 10 }), 10);
  assert.equal(budgetCost({ costUsd: 6, accountingComplete: true, budgetReservationUsd: 10 }), 6);
});

async function checkReservation(store: UsageStore, scope: string, pool?: Pool) {
  const incomplete = new UsageTracker(scope, { scope }, new PriceBook()).finish({ outcome: "max-turns", turns: 121, usageComplete: false });
  incomplete.costUsd = 6;
  if (!pool) incomplete.budgetReservationUsd = 10;
  await store.saveRecord(incomplete);
  if (pool) await pool.query("UPDATE agent_usage.usage_record SET budget_reservation_usd=10 WHERE run_id=$1", [scope]);
  const normal = new UsageTracker(scope + "-normal", { scope }, new PriceBook()).finish({ outcome: "success", turns: 2 });
  normal.costUsd = 8;
  await store.saveRecord(normal);
  assert.equal(await store.costSince(new Date(0), { scope }), 18);
  const guard = new BudgetGuard({ perRunUsd: 10, daily: [{ match: { scope }, limitUsd: 20 }] }, store);
  assert.equal((await guard.canStart({ scope })).allowed, true);
  assert.equal((await new BudgetGuard({ perRunUsd: 10, daily: [{ match: { scope }, limitUsd: 18 }] }, store).canStart({ scope })).allowed, false);
  const extra = { ...normal, runId: scope + "-extra", costUsd: 2.5 };
  await store.saveRecord(extra);
  assert.equal((await guard.canStart({ scope })).allowed, false, "reservation still consumes the original daily limit");
  const totals = (await store.totals({ from: new Date(0), match: { scope } }, "scope"))[0];
  assert.equal(totals.accountingComplete, false);
  assert.equal(totals.costUsd, 16.5, "historical cost is not replaced with the reservation");
  const record = (await store.records({ from: new Date(0), match: { scope } })).find(r => r.runId === scope)!;
  assert.equal(record.costUsd, 6);
  assert.equal(record.accountingComplete, false);
  assert.equal(record.budgetReservationUsd, 10);
}

test("JSONL uses an explicit reservation only for budgets and retains unknown actual cost", async t => {
  const folder = await mkdtemp(join(tmpdir(), "budget-reservation-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await checkReservation(new JsonlUsageStore(folder), randomUUID());
});

const url = process.env.AGENT_USAGE_TEST_DATABASE_URL;
test("PostgreSQL reservations preserve incomplete costs and enforce the daily limit", { skip: !url }, async () => {
  assert.equal(new URL(url!).hostname, "127.0.0.1");
  const pool = new Pool({ connectionString: url });
  const scope = randomUUID();
  try {
    const store = new PostgresUsageStore(pool);
    await store.ensureSchema();
    await store.ensureSchema();
    await checkReservation(store, scope, pool);
  } finally {
    await pool.query("DELETE FROM agent_usage.usage_record WHERE labels @> $1", [JSON.stringify({ scope })]);
    await pool.end();
  }
});
