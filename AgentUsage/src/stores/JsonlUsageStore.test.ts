import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, it, mock } from "node:test";
import { BudgetGuard } from "../BudgetGuard";
import { JsonlUsageStore } from "./JsonlUsageStore";

afterEach(() => { mock.restoreAll(); syncBuiltinESMExports(); });

it("treats missing files as empty, including a purge before any history exists", async (t) => {
  const folder = await fs.mkdtemp(join(tmpdir(), "usage-missing-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const store = new JsonlUsageStore(join(folder, "absent"));
  assert.equal(await store.costSince(new Date(0), {}), 0);
  assert.equal(await store.purgeTraceBefore(new Date()), 0);
});

for (const code of ["EACCES", "EIO"]) {
  it(`propagates ${code} through budgets and never rewrites unreadable trace history`, async (t) => {
    const folder = await fs.mkdtemp(join(tmpdir(), "usage-read-error-"));
    t.after(() => fs.rm(folder, { recursive: true, force: true }));
    const history = "synthetic existing history\n";
    const path = join(folder, "trace.jsonl");
    await fs.writeFile(path, history);
    const originalRead = fs.readFile.bind(fs);
    const failure = Object.assign(new Error(`synthetic ${code}`), { code });
    mock.method(fs, "readFile", async () => { throw failure; });
    const write = mock.method(fs, "writeFile");
    syncBuiltinESMExports();
    const store = new JsonlUsageStore(folder);
    const guard = new BudgetGuard({ perRunUsd: null, daily: [{ match: {}, limitUsd: 1 }] }, store);
    await assert.rejects(guard.canStart({}), (error) => error === failure);
    await assert.rejects(store.purgeTraceBefore(new Date()), (error) => error === failure);
    assert.equal(write.mock.callCount(), 0);
    assert.equal(await originalRead(path, "utf8"), history);
  });
}

it("retains newer trace events when purging readable history", async (t) => {
  const folder = await fs.mkdtemp(join(tmpdir(), "usage-purge-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const store = new JsonlUsageStore(folder);
  await store.appendTrace([1, 3].map((day) => ({ runId: "run", seq: day, type: "message", at: new Date(`2026-10-0${day}`), payload: {} })));
  assert.equal(await store.purgeTraceBefore(new Date("2026-10-02")), 1);
  assert.deepEqual((await store.trace("run")).map((event) => event.seq), [3]);
});
