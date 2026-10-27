import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, it, mock } from "node:test";
import type { AgentDefinition } from "../models/AgentDefinition";
import { JsonFileAgentConfigStore } from "./JsonFileAgentConfigStore";

const GLOBAL = { paused: false, pausedUntil: null, dailyBudgetUsd: 10 };
function agent(id: string): AgentDefinition {
  return {
    id, label: id, description: "", enabled: true, schedule: null, origin: "user",
    model: { provider: "synthetic", model: "synthetic" }, limits: { maxTurns: 1, timeoutMinutes: 1 },
    budgets: { perRunUsd: 1, dailyUsd: 1 }, capabilities: { webAccess: false, integrations: {} },
    skills: [], options: {}, canAssign: [], handles: [], waitFor: [], optionSpecs: [], integrationSpecs: [],
  };
}

afterEach(() => { mock.restoreAll(); syncBuiltinESMExports(); });

it("preserves concurrent agent/global edits across instances using one file", async (t) => {
  const folder = await fs.mkdtemp(join(tmpdir(), "config-concurrency-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const path = join(folder, "agents.json");
  const first = new JsonFileAgentConfigStore(path);
  const second = new JsonFileAgentConfigStore(path);
  await first.ensureDefaults([], GLOBAL);

  await Promise.all([
    ...Array.from({ length: 20 }, (_, n) => (n % 2 ? first : second).save(agent(`agent-${n}`))),
    second.saveGlobal({ ...GLOBAL, paused: true }),
    first.ensureDefaults([agent("default-agent")], GLOBAL),
  ]);
  assert.equal((await first.list()).length, 21);
  assert.equal((await first.getGlobal()).paused, true);
  await Promise.all([second.remove("agent-0"), first.save(agent("new-agent"))]);
  assert.equal(await first.get("agent-0"), null);
  assert.ok(await second.get("new-agent"));
});

it("keeps the previous readable file on failed replacement and recovers the mutation queue", async (t) => {
  const folder = await fs.mkdtemp(join(tmpdir(), "config-atomic-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const path = join(folder, "agents.json");
  const store = new JsonFileAgentConfigStore(path);
  await store.save(agent("alpha"));
  const previous = await fs.readFile(path, "utf8");
  const rename = mock.method(fs, "rename", async () => {
    assert.equal(await fs.readFile(path, "utf8"), previous);
    throw Object.assign(new Error("synthetic replacement failure"), { code: "EACCES" });
  });
  syncBuiltinESMExports();
  await assert.rejects(store.save(agent("bravo")), /synthetic replacement failure/);
  assert.equal(await fs.readFile(path, "utf8"), previous);
  assert.deepEqual(await fs.readdir(folder), ["agents.json"]);
  rename.mock.restore();
  syncBuiltinESMExports();
  await store.save(agent("charlie"));
  assert.equal((await store.list()).length, 2);
});

it("notifies listeners after successive atomic replacements", async (t) => {
  const folder = await fs.mkdtemp(join(tmpdir(), "config-watch-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const store = new JsonFileAgentConfigStore(join(folder, "agents.json"));
  await store.ensureDefaults([], GLOBAL);
  let notified: (() => void) | undefined;
  const close = await store.onChange(() => notified?.());
  t.after(close);
  for (const dailyBudgetUsd of [11, 12]) {
    let timer: ReturnType<typeof setTimeout>;
    const changed = new Promise<void>((resolve, reject) => {
      notified = resolve;
      timer = setTimeout(() => reject(new Error("No file change event")), 3000);
    });
    try {
      await store.saveGlobal({ ...GLOBAL, dailyBudgetUsd });
      await changed;
      assert.equal((await store.getGlobal()).dailyBudgetUsd, dailyBudgetUsd);
    } finally { clearTimeout(timer!); notified = undefined; }
  }
});

it("always exposes a complete previous or next JSON document during repeated writes", async (t) => {
  const folder = await fs.mkdtemp(join(tmpdir(), "config-readers-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const path = join(folder, "agents.json");
  const store = new JsonFileAgentConfigStore(path);
  await store.ensureDefaults([], GLOBAL);
  const results = await Promise.allSettled([
    Promise.all(Array.from({ length: 30 }, (_, n) => store.saveGlobal({ ...GLOBAL, dailyBudgetUsd: n }))),
    (async () => {
      for (let n = 0; n < 60; n++) {
        const document = JSON.parse(await fs.readFile(path, "utf8"));
        assert.equal(typeof document.global.dailyBudgetUsd, "number");
        assert.deepEqual(document.agents, {});
      }
    })(),
  ]);
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
  }
});
