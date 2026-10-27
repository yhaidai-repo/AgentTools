import assert from "node:assert/strict";
import { it } from "node:test";
import type { AgentDefinition } from "@agenttools/config";
import type { CommandContext } from "../models/CommandContext";
import { updateAgentCommand } from "./updateAgentCommand";

function fixture() {
  let definition: AgentDefinition = {
    id: "review-repair-test", label: "Test", description: "", enabled: true, schedule: null,
    model: { provider: "claude", model: "sonnet" }, limits: { maxTurns: 10, timeoutMinutes: 1 }, budgets: { perRunUsd: 1, dailyUsd: 1 },
    capabilities: { webAccess: false, integrations: {} }, skills: [], options: {}, canAssign: [], handles: ["research"], waitFor: [], optionSpecs: [], integrationSpecs: [], prompt: "v1", promptVersion: 1,
  };
  const history = new Map<number, { version: number; text: string }>([[1, { version: 1, text: "v1" }]]);
  let failSave = false;
  const save = async (next: AgentDefinition) => { if (failSave) { failSave = false; throw new Error("transient definition save failure"); } definition = structuredClone(next); };
  const context = {
    skills: { names: async () => [] },
    agents: {
      get: async () => structuredClone(definition), save,
      saveIfUnchanged: async (current: AgentDefinition, next: AgentDefinition) => {
        if (JSON.stringify(current) !== JSON.stringify(definition)) return false;
        await save(next);
        return true;
      },
    },
    db: {
      select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [...history.values()].sort((a, b) => b.version - a.version).slice(0, 1) }) }) }) }),
      insert: () => ({ values: (row: { version: number; text: string }) => ({ onConflictDoNothing: () => ({ returning: async () => { if (history.has(row.version)) return []; history.set(row.version, row); return [{ version: row.version }]; } }) }) }),
    },
  } as unknown as CommandContext;
  return { context, history, definition: () => definition, secondContext: () => ({ ...context, agents: { ...context.agents! } }), failNextSave: () => { failSave = true; } };
}

it("S3-04 recovers from a history insert followed by a failed definition save", async () => {
  const f = fixture();
  f.failNextSave();
  await assert.rejects(updateAgentCommand.run(f.context, { id: "review-repair-test", prompt: "new prompt" }), /transient/);
  assert.equal(f.definition().promptVersion, 1);
  const result = await updateAgentCommand.run(f.context, { id: "review-repair-test", prompt: "new prompt" });
  assert.ok(result.ok);
  assert.equal(result.value.promptVersion, 2);
  assert.equal(f.history.size, 2);
});

it("S3-04 concurrent different prompt edits reserve distinct history versions", async () => {
  const f = fixture();
  const results = await Promise.all([f.context, f.secondContext()].map((context, i) => updateAgentCommand.run(context, { id: "review-repair-test", prompt: i === 0 ? "first edit" : "second edit" })));
  assert.ok(results.every((result) => result.ok));
  assert.deepEqual([...new Set([...f.history.values()].map((row) => row.text))].sort(), ["first edit", "second edit", "v1"]);
  assert.equal(f.history.get(f.definition().promptVersion!)?.text, f.definition().prompt);
});

it("S3-04 a delayed label edit cannot undo another process's prompt edit", async () => {
  const f = fixture();
  const second = f.secondContext();
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  const proceed = new Promise<void>((resolve) => { release = resolve; });
  const save = f.context.agents!.saveIfUnchanged!;
  f.context.agents!.saveIfUnchanged = async (current, next) => {
    if (current.promptVersion === 1) { enter(); await proceed; }
    return save(current, next);
  };
  const label = updateAgentCommand.run(f.context, { id: "review-repair-test", label: "New label" });
  try {
    await entered;
    assert.ok((await updateAgentCommand.run(second, { id: "review-repair-test", prompt: "new prompt" })).ok);
  } finally { release(); }
  assert.ok((await label).ok);
  assert.equal(f.definition().label, "New label");
  assert.equal(f.definition().prompt, "new prompt");
  assert.equal(f.definition().promptVersion, 2);
});
