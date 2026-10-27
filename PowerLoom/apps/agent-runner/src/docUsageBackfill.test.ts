import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { PowerLoomDb } from "@powerloom/db";
import type { UsageStore } from "@agenttools/usage";
import { backfillDocUsage } from "./docUsageBackfill";

it("backfills only reliable requested-vault runs, including non-PBI tasks, and skips logged sessions", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "usage-backfill-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "personal"));
  const rows = [
    { id: 101, taskVault: "personal", pbiVault: "other" },
    { id: 202, taskVault: "other", pbiVault: "personal" },
    { id: 303, taskVault: null, pbiVault: "personal" },
    { id: 404, taskVault: "personal", pbiVault: null },
    { id: 505, taskVault: null, pbiVault: null },
  ];
  const dialect = new PgDialect();
  let joins = 0;
  const query = {
    from: () => query,
    leftJoin: () => { joins++; return query; },
    where: async (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
      const statement = dialect.sqlToQuery(condition);
      assert.match(statement.sql, /coalesce\(/);
      assert.ok(statement.params.includes("personal"));
      return rows.filter((row) => (row.taskVault ?? row.pbiVault) === "personal").map((row) => ({ id: row.id, stage: "synthetic" }));
    },
  };
  const db = { select: () => query } as unknown as PowerLoomDb;
  const seen: string[] = [];
  const usage = { trace: async (id: string) => { seen.push(id); return [{ runId: id, seq: 1, at: new Date(), type: "tool_call", payload: { name: "read_doc", input: { path: `synthetic/${id}.md` } } }]; } } as unknown as UsageStore;
  assert.deepEqual(await backfillDocUsage(db, usage, "personal", root), { reads: 3, runs: 3 });
  assert.deepEqual(seen, ["101", "303", "404"]);
  assert.equal(joins, 2);
  const path = join(root, "personal", ".usage", "usage.jsonl");
  const before = await readFile(path, "utf8");
  assert.deepEqual(before.trim().split("\n").map((line) => JSON.parse(line).session), ["RUN-101", "RUN-303", "RUN-404"]);
  assert.deepEqual(await backfillDocUsage(db, usage, "personal", root), { reads: 0, runs: 0 });
  assert.equal(await readFile(path, "utf8"), before);
});

it("validates output paths before queries or writes, rejecting outside and inside-vault aliases", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "usage-backfill-paths-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const vault = join(root, "personal");
  const outside = join(root, "outside");
  const verified = join(vault, "verified");
  for (const path of [vault, outside, verified]) await mkdir(path, { recursive: true });
  await writeFile(join(outside, "keep.txt"), "synthetic unchanged");
  const db = { select: () => { throw new Error("query must not run"); } } as unknown as PowerLoomDb;
  for (const name of ["../outside", "personal/../outside", "personal."]) await assert.rejects(backfillDocUsage(db, {} as UsageStore, name, root), /Invalid vault/);
  for (const target of [outside, verified]) {
    await symlink(target, join(vault, ".usage"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(backfillDocUsage(db, {} as UsageStore, "personal", root), /aliases/);
    await rm(join(vault, ".usage"));
  }
  assert.equal(await readFile(join(outside, "keep.txt"), "utf8"), "synthetic unchanged");
});
