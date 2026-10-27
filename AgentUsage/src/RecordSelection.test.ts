import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { Pool } from "pg";
import type { UsageRecord } from "./models/UsageRecord";
import type { UsageStore } from "./models/UsageStore";
import { JsonlUsageStore } from "./stores/JsonlUsageStore";
import { PostgresUsageStore } from "./stores/PostgresUsageStore";

const from = new Date("2026-10-26T00:00:00Z"), to = new Date("2026-10-27T00:00:00Z");
function fixture() {
  const prefix = randomUUID();
  const record = (id: string, time: number, accountingComplete = true): UsageRecord => ({
    runId: `${prefix}-${id}`, labels: { agent: "worker", scope: prefix }, startedAt: new Date(time), endedAt: new Date(time + 1),
    durationMs: 500, turns: 1, outcome: "success", error: null, inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40,
    costUsd: 1.25, accountingComplete, providerCostUsd: null, models: [], subscription: [],
  });
  const owned = Array.from({ length: 5001 }, (_, i) => record(`owned-${String(i).padStart(5, "0")}`, from.getTime() + (i === 0 ? 0 : 1), i !== 5000));
  const outside = [record("before", from.getTime() - 1), record("at-end", to.getTime())];
  const records = [...owned, ...outside, ...Array.from({ length: 5001 }, (_, i) => record(`other-${i}`, from.getTime() + 100))];
  return { owned, records, runIds: [...owned, ...outside].map((row) => row.runId), prefix };
}

async function check(store: UsageStore, f: ReturnType<typeof fixture>) {
  const query = { from, to, runIds: f.runIds, match: { scope: f.prefix } };
  const records = await store.records(query);
  assert.equal(records.length, 5001);
  assert.equal(new Set(records.map((row) => row.runId)).size, 5001);
  assert.equal(records.reduce((sum, row) => sum + row.costUsd, 0), 5001 * 1.25);
  assert.equal(records.reduce((sum, row) => sum + row.durationMs, 0), 5001 * 500);
  assert.equal((await store.records(query, 2)).length, 2);
  assert.deepEqual((await store.records(query, 2)).map((row) => row.runId), records.slice(0, 2).map((row) => row.runId));
  assert.deepEqual(await store.records({ ...query, runIds: [] }), []);
  assert.deepEqual(await store.totals({ ...query, runIds: [] }, "agent"), []);
  const [totals] = await store.totals(query, "agent");
  assert.equal(totals.runs, 5001);
  assert.equal(totals.costUsd, 5001 * 1.25);
  assert.equal(totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens, 5001 * 100);
  assert.equal(totals.accountingComplete, false);
  assert.equal((await store.records({ ...query, from: new Date(from.getTime() + 1), to: new Date(from.getTime() + 2) })).length, 5000);
}

it("JSONL selects complete owned usage before limits, with tied dates and incomplete accounting", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "usage-selection-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const f = fixture();
  await writeFile(join(folder, "usage.jsonl"), f.records.map((row) => JSON.stringify(row)).join("\n") + "\n");
  await check(new JsonlUsageStore(folder), f);
});

const databaseUrl = process.env.AGENT_USAGE_TEST_DATABASE_URL;
it("PostgreSQL selects complete owned usage before limits with the same boundaries", { skip: !databaseUrl }, async () => {
  assert.equal(new URL(databaseUrl!).hostname, "127.0.0.1");
  const pool = new Pool({ connectionString: databaseUrl });
  const f = fixture();
  const ids = f.records.map((row) => row.runId);
  try {
    const store = new PostgresUsageStore(pool);
    await store.ensureSchema();
    await pool.query(`INSERT INTO agent_usage.usage_record
      (run_id,labels,started_at,ended_at,duration_ms,turns,outcome,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,cost_usd,models,accounting_complete)
      SELECT id, $4::jsonb, at, at + interval '1 millisecond', 500, 1, 'success', 10, 20, 30, 40, 1.25, '[]'::jsonb, complete
      FROM unnest($1::text[], $2::timestamptz[], $3::boolean[]) AS fixture(id,at,complete)`,
    [ids, f.records.map((row) => row.startedAt), f.records.map((row) => row.accountingComplete), JSON.stringify({ agent: "worker", scope: f.prefix })]);
    await check(store, f);
  } finally {
    await pool.query("DELETE FROM agent_usage.usage_record WHERE run_id = ANY($1::text[])", [ids]).finally(() => pool.end());
  }
});
