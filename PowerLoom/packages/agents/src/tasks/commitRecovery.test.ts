import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import type { PowerLoomDb } from "@powerloom/db";
import { JsonlUsageStore, PriceBook } from "@agenttools/usage";
import { AgentRunSession } from "../AgentRunSession";
import { loadPreviousRunFacts, PreviousCommitStateError } from "../resume/continuationMessage";
import { replayDraft } from "../resume/replayDraft";
import { commitStep } from "./commitStep";
import { addRunOutputs } from "./runOutputs";

const databaseUrl = process.env.POWERLOOM_ACCESS_TEST_DATABASE_URL;
it("restores drafts after commit starts, rolls back failed outputs and reuses only durable partial receipts", { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.pathname, "/synthetic_access");
  const namespace = `commit_${randomUUID().replaceAll("-", "")}`;
  const folder = await mkdtemp(join(tmpdir(), "powerloom-commit-"));
  const admin = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${namespace}` });
  try {
    await admin.query(`create schema ${namespace}`);
    await pool.query("create table agent_run(id bigint primary key, outputs jsonb, outcome text, error text, ended_at timestamptz, commit_started_at timestamptz, commit_completed_at timestamptz)");
    await pool.query("create table agent_commit_step(root_run_id bigint, step_key text, result jsonb, primary key(root_run_id,step_key))");
    await pool.query("create table synthetic_output(name text primary key)");
    await pool.query("insert into agent_run(id) values (1),(2),(3)");
    const db = drizzle(pool) as unknown as PowerLoomDb;
    const store = new JsonlUsageStore(folder);
    const deps = { db, usageStore: store, prices: new PriceBook() };
    const session = (id: number) => Reflect.construct(AgentRunSession, [deps, id, { labels: {} }, { continues: null }]) as AgentRunSession;
    const success = (runId: number) => ({ runId, outcome: "success" as const, error: null, costUsd: 0, rateLimitResetsAt: null });
    const output = (runId: number, name: string, fail = false) => commitStep(db, 1, runId, name, { body: name }, async tx => {
      await tx.execute(sql`insert into synthetic_output values (${name})`);
      await addRunOutputs(tx, runId, [name]);
      if (fail) throw new Error("synthetic output failure");
      return name;
    });
    const started = new Date();
    const final = await session(1).finish(success(1), async () => { await output(1, "saved"); await output(1, "unsaved", true); });
    assert.equal(final.outcome, "failed");
    const row = (await pool.query("select * from agent_run where id=1")).rows[0];
    assert.ok(row.commit_started_at);
    assert.equal(row.commit_completed_at, null);
    assert.deepEqual((await pool.query("select name from synthetic_output")).rows, [{ name: "saved" }]);
    const facts = await loadPreviousRunFacts(store, { id: 1, startedAt: started, outputs: row.outputs, commitStartedAt: row.commit_started_at, commitCompletedAt: row.commit_completed_at } as any);
    assert.equal(facts.committed, false); // The real trace contains phase=commit, but that is not persistence evidence.
    assert.equal(Reflect.construct(AgentRunSession, [deps, 2, { labels: {} }, { continues: { id: 1, commitRootRunId: 1, commitCompletedAt: null } }]).commitRootRunId, 1);
    await assert.rejects(loadPreviousRunFacts(store, { id: 99, outputs: ["legacy-output"] } as any), PreviousCommitStateError);
    let restored = 0;
    await replayDraft({ toolCalls: async () => [{ name: "write_result", input: {}, output: "Noted", isError: false }] } as any, "synthetic", [{ name: "write_result", replayOnResume: true, handler: async () => { restored++; return { text: "Noted" }; } }] as any, { withDrafts: !facts.committed });
    assert.equal(restored, 1);
    const resumed = await session(2).finish(success(2), async () => { await output(2, "saved"); await output(2, "unsaved"); });
    assert.equal(resumed.outcome, "success");
    assert.equal((await pool.query("select count(*)::int as count from synthetic_output")).rows[0].count, 2);
    assert.deepEqual((await pool.query("select outputs from agent_run where id=2")).rows[0].outputs, ["saved", "unsaved"]);
    assert.ok((await pool.query("select commit_completed_at from agent_run where id=2")).rows[0].commit_completed_at);
    const beforeAny = await session(3).finish(success(3), async () => { throw new Error("synthetic before output"); });
    assert.equal(beforeAny.outcome, "failed");
    assert.equal((await pool.query("select commit_completed_at from agent_run where id=3")).rows[0].commit_completed_at, null);
  } finally {
    await pool.end();
    await admin.query(`drop schema if exists ${namespace} cascade`).finally(() => admin.end());
    await rm(folder, { recursive: true, force: true });
  }
});
