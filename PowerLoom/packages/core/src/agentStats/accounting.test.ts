import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { BudgetGuard, JsonlUsageStore, PriceBook, UsageTracker } from "@agenttools/usage";
import { loadRunTotals } from "./agentTotals";
import { spentToday, spentTodayByAgent } from "./budgetUsage";

it("keeps incomplete accounting unknown in display totals while refusing the daily budget", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "core-accounting-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const store = new JsonlUsageStore(folder);
  const tracker = new UsageTracker("1", { agent: "synthetic", run: "1" }, new PriceBook());
  const record = tracker.finish({ outcome: "failed", turns: 2, usageComplete: false });
  await store.saveRecord(record);
  assert.equal(await spentToday(store, { agent: "synthetic" }), null);
  assert.equal((await spentTodayByAgent(store, ["synthetic"])).get("synthetic"), null);
  const totals = await loadRunTotals(store, [{ id: 1, startedAt: record.startedAt }]);
  assert.equal(totals.accountingComplete, false);
  const guard = new BudgetGuard({ perRunUsd: null, daily: [{ match: { agent: "synthetic" }, limitUsd: 1 }] }, store);
  assert.equal((await guard.canStart({ agent: "synthetic" })).allowed, false);
});
