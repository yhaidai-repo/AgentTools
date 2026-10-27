import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { vaultCapture, type PowerLoomDb } from "@powerloom/db";
import { VaultCaptureCli } from "./VaultCaptureCli";
import { writeDrafts } from "./writeDrafts";

afterEach(() => mock.restoreAll());

function fixture(rejected = true) {
  let capture: Record<string, any> = { id: 1, pbiId: 7, itemId: "AT-7-1", runId: 9, project: "demo", name: "synthetic", title: "Synthetic", target: "demo", captured: ["Synthetic fact"], assumptions: [], toFill: [], status: "pending" };
  let tasks: Record<string, unknown>[] = [];
  let failInsert = false;
  let failCommit = false;
  let tail: Promise<unknown> = Promise.resolve();
  let nextId = 0;
  const cli = { vaultName: "personal", capture: async () => ({ ok: !rejected, mode: rejected ? "rejected" : "created", path: rejected ? null : "/synthetic/draft.md", errors: rejected ? ["synthetic rejection"] : [] }), relativePath: () => "draft/synthetic.md" };
  mock.method(VaultCaptureCli, "forVault", async () => cli as unknown as VaultCaptureCli);
  const dialect = new PgDialect();
  const db = {
    select: () => ({ from: (table: unknown) => ({ where: async () => table === vaultCapture ? capture.status === "pending" ? [{ ...capture }] : [] : [{ vault: "personal" }] }) }),
    update: () => ({ set: (changes: Record<string, unknown>) => ({ where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => ({ returning: async () => {
      const statement = dialect.sqlToQuery(condition);
      if (statement.params.includes("pending") && capture.status !== "pending") return [];
      capture = { ...capture, ...changes };
      return [{ ...capture }];
    } }) }) }),
    insert: () => ({ values: async (task: Record<string, unknown>) => { if (failInsert) throw new Error("synthetic task insert failed"); tasks.push(task); } }),
    execute: async () => ({ rows: [{ id: `HT-7-${++nextId}` }] }),
    transaction: (operation: (tx: unknown) => Promise<unknown>) => {
      const current = tail.then(async () => {
        const before = { ...capture };
        const beforeTasks = [...tasks];
        try { const result = await operation(db); if (failCommit) throw new Error("synthetic transaction commit failed"); return result; }
        catch (error) { capture = before; tasks = beforeTasks; throw error; }
      });
      tail = current.catch(() => undefined);
      return current;
    },
  };
  return { db: db as unknown as PowerLoomDb, capture: () => capture, tasks: () => tasks, failInsert: (value: boolean) => { failInsert = value; }, failCommit: (value: boolean) => { failCommit = value; } };
}

it("keeps a failed rejection handover pending and retries to exactly one human task", async () => {
  const state = fixture();
  state.failInsert(true);
  await assert.rejects(writeDrafts(state.db, 7), /task insert failed/);
  assert.equal(state.capture().status, "pending");
  assert.equal(state.tasks().length, 0);
  state.failInsert(false);
  await writeDrafts(state.db, 7);
  await writeDrafts(state.db, 7);
  assert.equal(state.capture().status, "rejected");
  assert.equal(state.tasks().length, 1);
  assert.equal((state.tasks()[0].data as { captureId: number }).captureId, 1);
});

it("rolls back both the rejection and human task when the transaction cannot commit", async () => {
  const state = fixture();
  state.failCommit(true);
  await assert.rejects(writeDrafts(state.db, 7), /transaction commit failed/);
  assert.equal(state.capture().status, "pending");
  assert.equal(state.tasks().length, 0);
  state.failCommit(false);
  await writeDrafts(state.db, 7);
  assert.equal(state.tasks().length, 1);
});

it("uses the pending predicate to avoid duplicate handovers from simultaneous publishers", async () => {
  const state = fixture();
  await Promise.all([writeDrafts(state.db, 7), writeDrafts(state.db, 7)]);
  assert.equal(state.capture().status, "rejected");
  assert.equal(state.tasks().length, 1);
});

it("continues to publish valid drafts without creating human tasks", async () => {
  const state = fixture(false);
  await writeDrafts(state.db, 7);
  assert.equal(state.capture().status, "created");
  assert.equal(state.capture().filePath, "draft/synthetic.md");
  assert.equal(state.tasks().length, 0);
});
