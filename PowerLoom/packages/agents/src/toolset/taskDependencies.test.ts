import assert from "node:assert/strict";
import { it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { agentRun, localItem, type PowerLoomDb } from "@powerloom/db";
import { AgentToolset } from "./AgentToolset";
import { DuplicateGuard } from "../DuplicateGuard";
import { commitCreatedTasks, resolveTaskDependencies } from "../taskCreation/commitCreatedTasks";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";

const draft = (title: string, dependsOn: string[] = []): CreatedTask => ({ assignee: "research", kind: "task", title, dependsOn, goal: "Synthetic", doneWhen: "Done", outOfScope: null, effort: "trace", reason: "Synthetic", evidence: [], blocking: true, options: [], steps: [], docPath: null });
const drafts = () => [draft("First"), draft("Second", ["new:1", "HT-existing"]), draft("Third", ["new:1", "new:2"])];

function fixture() {
  const dialect = new PgDialect();
  let rows: any[] = [];
  let outputs = new Map<number, string[]>();
  let journal = new Map<string, unknown>();
  let sequence = 0;
  let failTitle: string | null = null;
  const fake = {
    transaction: async (action: (tx: unknown) => Promise<unknown>) => {
      const before = { rows: structuredClone(rows), outputs: new Map([...outputs].map(([id, values]) => [id, [...values]])), journal: new Map(journal) };
      try { return await action(fake); }
      catch (error) { rows = before.rows; outputs = before.outputs; journal = before.journal; throw error; }
    },
    select: () => ({ from: (table: unknown) => ({ where: (predicate: any) => {
      const runId = dialect.sqlToQuery(predicate).params[0] as number;
      return Promise.resolve(table === agentRun ? [{ outputs: outputs.get(runId) ?? [] }] : []);
    } }) }),
    update: (table: unknown) => ({ set: (changes: any) => ({ where: async (predicate: any) => {
      if (table === agentRun && changes.outputs) {
        const runId = dialect.sqlToQuery(predicate).params[0] as number;
        const added = JSON.parse(dialect.sqlToQuery(changes.outputs).params[0] as string);
        outputs.set(runId, [...new Set([...(outputs.get(runId) ?? []), ...added])]);
      }
    } }) }),
    insert: (table: unknown) => ({ values: async (value: any) => {
      if (table === localItem) {
        if (value.title === failTitle) throw new Error("synthetic task insert failed");
        rows.push(JSON.parse(JSON.stringify(value)));
      }
    } }),
    execute: async (statement: any) => {
      const query = dialect.sqlToQuery(statement);
      const key = `${query.params[0]}:${query.params[1]}`;
      if (query.sql.includes("select result from agent_commit_step")) return { rows: journal.has(key) ? [{ result: journal.get(key) }] : [] };
      if (query.sql.includes("insert into agent_commit_step")) { journal.set(key, JSON.parse(query.params[2] as string)); return { rows: [] }; }
      if (query.sql.includes("pg_advisory_xact_lock")) return { rows: [] };
      return { rows: [{ id: `AT-${String(++sequence).padStart(3, "0")}` }] };
    },
  };
  const db = fake as unknown as PowerLoomDb;
  const context = { deps: { db, docsVaultName: "demo" }, agent: { id: "synthetic", capabilities: { integrations: {} } } };
  const open = (runId: number, tasks = drafts()) => {
    const toolset = Reflect.construct(AgentToolset, [context, { runId, commitRootRunId: 1 }, { id: "AT-parent", pbiId: null, vault: "demo" }, { repos: { repos: [] }, writers: [] }, null, DuplicateGuard.none(), { depth: 1 }]) as AgentToolset;
    toolset.tasks.push(...tasks);
    return toolset;
  };
  return { db, open, rows: () => rows, outputs: (runId: number) => outputs.get(runId), fail: (title: string | null) => { failTitle = title; } };
}

function assertDependencies(rows: any[], ids: string[]) {
  assert.deepEqual(rows.map(row => row.id), ids);
  assert.deepEqual(rows.map(row => row.data.dependsOn), [[], [ids[0], "HT-existing"], [ids[0], ids[1]]]);
}

it("commits a multi-task chain with multiple new references in original order", async () => {
  const f = fixture();
  const committed = await f.open(1).commit(1);
  assert.equal(committed.taskIds.length, 3);
  assertDependencies(f.rows(), committed.taskIds);
});

it("reuses the first task receipt after a later insert fails and resolves resumed dependencies", async () => {
  const f = fixture();
  f.fail("Second");
  await assert.rejects(f.open(1).commit(1), /task insert failed/);
  assert.equal(f.rows().length, 1);
  const first = structuredClone(f.rows()[0]);
  f.fail(null);
  const resumed = await f.open(2).commit(2);
  assert.equal(resumed.taskIds[0], first.id);
  assert.deepEqual(f.rows()[0], first);
  assertDependencies(f.rows(), resumed.taskIds);
  assert.deepEqual(f.outputs(2), resumed.taskIds);
  await f.open(3).commit(3);
  assert.equal(f.rows().length, 3);
});

it("keeps batch-helper dependencies working and rejects unresolved references before inserting them", async () => {
  const f = fixture();
  const ids = await commitCreatedTasks(f.db, { pbiId: null, vault: "demo", docsVault: "demo", parentTaskId: "AT-parent", runId: 1, depth: 1 }, drafts());
  assertDependencies(f.rows(), ids);
  for (const reference of ["new:0", "new:1", "new:2", "new:999999999999999999999", "new:bad"]) {
    const invalid = fixture();
    await assert.rejects(invalid.open(1, [draft("Invalid", [reference])]).commit(1), /Unresolved task dependency/);
    assert.equal(invalid.rows().length, 0);
  }
  assert.throws(() => resolveTaskDependencies([null as never], []), /non-empty ID/);
});

it("binds a dependent task receipt to the resolved earlier task ID", async () => {
  const f = fixture();
  const original = await f.open(1).commit(1);
  const changed = drafts();
  changed[0].goal = "A different first task";
  const updated = await f.open(2, changed).commit(2);
  assert.notEqual(updated.taskIds[0], original.taskIds[0]);
  assert.notEqual(updated.taskIds[1], original.taskIds[1]);
  assertDependencies(f.rows().slice(3), updated.taskIds);
});
