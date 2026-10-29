import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as core from "@powerloom/core";
import type { AgentDefinition } from "@agenttools/config";
import { JsonlUsageStore, type UsageRecord } from "@agenttools/usage";
import { getUsageSummaryCommand } from "../../../packages/core/src/commands/getUsageSummaryCommand";

const require = createRequire(import.meta.url);
class Redirect extends Error {}

// Execute actual action/component source, replacing only framework and service boundaries.
async function source(path: string, ports: Record<string, unknown>): Promise<Record<string, (...args: any[]) => any>> {
  const file = new URL(path, import.meta.url);
  const javascript = ts.transpileModule(await readFile(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports, require: (id: string) => id in ports ? ports[id] : require(id), FormData, Set, console };
  vm.runInNewContext(javascript, sandbox, { filename: file.pathname });
  return module.exports;
}

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  return data;
}

it("schedule edits with empty or invalid cron preserve fields and never create immediate tasks", async () => {
  const calls: string[] = [];
  const actions = await source("../app/tasks/new/actions.ts", {
    "@powerloom/core": core, "next/cache": { revalidatePath() {} }, "next/navigation": { redirect() { throw new Redirect(); }, unstable_rethrow(error: unknown) { if (error instanceof Redirect) throw error; } },
    "@/lib/currentVault": { requireVault: async () => "synthetic" }, "@/lib/formFields": { formText: (data: FormData, key: string) => String(data.get(key) ?? "").trim() || null },
    "@/lib/items": { itemPath: () => "/tasks/task-1" },
    "@/lib/commandContext": { runWebCommand: async (command: core.Command<unknown, unknown>, input: any) => {
      calls.push(command.name);
      const parsed = command.input.safeParse(input);
      if (!parsed.success) return { ok: false, error: "Cron is required." };
      if (command.name === "schedule.save" && input.cron === "invalid") return { ok: false, error: "Invalid cron." };
      return command.name === "task.create" ? { ok: true, value: { taskId: "task-1", pbiId: null } } : { ok: true, value: { id: 7 } };
    } },
  });
  const base = { scheduleId: "7", title: "Typed title", description: "Typed description", acceptanceCriteria: "Typed criteria", type: "research", repos: ["repo-one"], enabled: "on", cron: "" };
  for (const cron of ["", "invalid"]) {
    const result = await actions.saveTaskAction(null, form({ ...base, cron }));
    assert.equal(result.ok, false);
    assert.equal(result.values.title, base.title);
    assert.equal(result.values.cron, cron);
    assert.equal(result.values.scheduleId, 7);
    const components = await source("../app/tasks/new/TaskForm.tsx", {
      react: { useActionState: () => [result, () => {}, false], useState: (value: unknown) => [value, () => {}] },
      "next/link": { __esModule: true, default: (props: any) => createElement("a", props) }, "../RepoChoices": { RepoChoices: () => null }, "./actions": actions, "./GuideFields": { GuideFields: () => null }, "@powerloom/core/demonstrations": { DEMONSTRATION_LABEL: "Demonstration" },
    });
    const html = renderToStaticMarkup(components.TaskForm({ values: result.values, types: ["research"], repos: [] }));
    assert.match(html, /Save schedule/);
    assert.match(html, /Typed title/);
    assert.match(html, cron === "" ? /Cron is required/ : /Invalid cron/);
  }
  assert.deepEqual(calls, ["schedule.save", "schedule.save"]);
  await assert.rejects(actions.saveTaskAction(null, form({ ...base, scheduleId: "", cron: "" })), Redirect);
  await assert.rejects(actions.saveTaskAction(null, form({ ...base, scheduleId: "", cron: "0 7 * * 1" })), Redirect);
  await assert.rejects(actions.saveTaskAction(null, form({ ...base, cron: "0 7 * * 1" })), Redirect);
  assert.deepEqual(calls.slice(2), ["task.create", "schedule.save", "schedule.save"]);
});

async function agentFixture(existing = false) {
  const definitions = new Map<string, AgentDefinition>();
  const history = new Map<number, { version: number; text: string }>();
  const skills = new Map<string, string>();
  let skillWrites = 0, agentWrites = 0, failSave = false, loseResponse = false;
  const agents = {
    list: async () => [...definitions.values()], get: async (id: string) => definitions.get(id) ?? null,
    save: async (agent: AgentDefinition) => { if (failSave) { failSave = false; throw new Error("synthetic save failed"); } agentWrites++; definitions.set(agent.id, structuredClone(agent)); },
  };
  const template = await core.newAgentTemplate(agents as any, "synthetic-agent");
  const prompt = "Review ordinary changes with this complete prompt.";
  if (existing) definitions.set(template.id, { ...template, prompt, promptVersion: 1, handles: ["research"] });
  if (existing) history.set(1, { version: 1, text: prompt });
  const context = {
    agents, skills: { names: async () => [...skills.keys()], read: async (name: string) => skills.has(name) ? { name, folder: "synthetic", editable: true, content: skills.get(name)! } : null },
    powerloom: { addPromptVersion: async (_id: string, version: number, text: string) => {
      if (history.has(version)) return { ok: false, error: "Version already exists" };
      history.set(version, { version, text });
      return { ok: true, value: version };
    }, createSkill: async (name: string, content: string) => {
      if (skills.has(name)) return { ok: false, error: "exists already" };
      skillWrites++; skills.set(name, content);
      return loseResponse ? { ok: false, error: "response lost" } : { ok: true, value: name };
    } }, db: { select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [...history.values()].sort((a, b) => b.version - a.version).slice(0, 1) }) }) }) }) },
  } as unknown as core.CommandContext;
  const actions = await source("../app/agents/configActions.ts", {
    "@powerloom/core": core, "next/cache": { revalidatePath() {} }, "next/navigation": { redirect() { throw new Redirect(); }, unstable_rethrow(error: unknown) { if (error instanceof Redirect) throw error; } },
    "@/lib/agentConfig": { getAgentConfig: () => agents }, "@/lib/commandContext": { runWebCommand: (command: any, input: unknown) => core.runCommand(command, context, input) },
  });
  const values = { id: template.id, label: "Synthetic agent", prompt, handles: ["research"], model: template.model.model, maxTurns: "10", timeoutMinutes: "5", perRunUsd: "1", dailyUsd: "5", newSkillName: "synthetic-skill", newSkillDescription: "Use when: reviewing ordinary changes", newSkillContent: "## Checklist\n- Check ordinary code changes carefully." };
  return { actions, values, skills, definitions, writes: () => ({ skillWrites, agentWrites }), failNextSave: () => { failSave = true; }, loseSkillResponse: () => { loseResponse = true; } };
}

it("create and update preflight reject invalid agent input before creating a skill", async () => {
  const created = await agentFixture();
  assert.equal((await created.actions.createAgentAction(null, form({ ...created.values, prompt: "short" }))).ok, false);
  assert.deepEqual(created.writes(), { skillWrites: 0, agentWrites: 0 });
  const updated = await agentFixture(true);
  assert.equal((await updated.actions.saveAgentAction(null, form({ ...updated.values, maxTurns: "0" }))).ok, false);
  assert.equal((await updated.actions.saveAgentAction(null, form({ ...updated.values, skills: ["unknown-skill"] }))).ok, false);
  assert.deepEqual(updated.writes(), { skillWrites: 0, agentWrites: 0 });
});

for (const existing of [false, true]) it(`combined ${existing ? "update" : "create"} recovers after skill publication and a later save failure`, async () => {
  const f = await agentFixture(existing);
  f.failNextSave();
  const action = existing ? f.actions.saveAgentAction : f.actions.createAgentAction;
  const refusal = await action(null, form(f.values));
  assert.equal(refusal.ok, false);
  assert.match(refusal.message, /synthetic save failed.*retrying will reuse/);
  const original = f.skills.get("synthetic-skill");
  if (existing) assert.equal((await action(refusal, form(f.values))).ok, true);
  else await assert.rejects(action(refusal, form(f.values)), Redirect);
  assert.deepEqual(f.writes(), { skillWrites: 1, agentWrites: 1 });
  assert.equal(f.skills.get("synthetic-skill"), original);
  assert.deepEqual(f.definitions.get(f.values.id)?.skills, ["synthetic-skill"]);
});

it("a changed skill after a partial save refuses retry without overwriting unrelated content", async () => {
  const f = await agentFixture();
  f.failNextSave();
  await f.actions.createAgentAction(null, form(f.values));
  f.skills.set("synthetic-skill", "Unrelated changed skill content");
  const result = await f.actions.createAgentAction(null, form(f.values));
  assert.equal(result.ok, false);
  assert.match(result.message, /exists already/);
  assert.equal(f.skills.get("synthetic-skill"), "Unrelated changed skill content");
  assert.deepEqual(f.writes(), { skillWrites: 1, agentWrites: 0 });
});

it("a lost skill-publication response reuses the persisted identical result", async () => {
  const f = await agentFixture();
  f.loseSkillResponse();
  await assert.rejects(f.actions.createAgentAction(null, form(f.values)), Redirect);
  assert.deepEqual(f.writes(), { skillWrites: 1, agentWrites: 1 });
});

for (const ownedCount of [1, 5001]) it(`web and shared read totals keep ${ownedCount} owned records beyond 5,000 unrelated records`, async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "web-usage-selection-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const from = new Date(Date.now() - 60_000), now = new Date();
  const ids = Array.from({ length: ownedCount }, (_, i) => String(i + 1));
  const record = (runId: string, startedAt: Date, complete = true): UsageRecord => ({ runId, labels: { agent: "worker" }, startedAt, endedAt: startedAt, durationMs: 1000, turns: 1, outcome: "success", error: null, inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40, costUsd: 5, providerCostUsd: null, accountingComplete: complete, models: [], subscription: [] });
  const records = [...ids.map((id, i) => record(id, from, i !== ownedCount - 1)), ...Array.from({ length: 5001 }, (_, i) => record(`other-${i}`, now))];
  await writeFile(join(folder, "usage.jsonl"), records.map((row) => JSON.stringify(row)).join("\n"));
  const usage = new JsonlUsageStore(folder);
  const builder: any = { from() { return this; }, leftJoin() { return this; }, where() { return this; }, groupBy: async () => [], then(resolve: (value: unknown) => unknown) { return Promise.resolve(ids.map((id) => ({ id: Number(id) }))).then(resolve); } };
  const db = { select: () => builder, execute: async () => ({ rows: [] }) } as unknown as core.CommandContext["db"];
  const expected = { runs: ownedCount, tokens: ownedCount * 100, costUsd: ownedCount * 5, durationMs: ownedCount * 1000, accountingComplete: false };
  assert.deepEqual(await core.loadRunTotals(usage, ids.map((id) => ({ id: Number(id), startedAt: from }))), expected);
  assert.deepEqual((await core.loadAgentTotals(db, usage, from, "synthetic")).get("worker"), expected);
  const summary = await core.runCommand(getUsageSummaryCommand, { db, usage } as unknown as core.CommandContext, { vault: "synthetic", period: "1h" });
  assert.ok(summary.ok);
  assert.deepEqual(summary.value.total, expected);
  const activity = await source("./agentActivity.ts", {
    "@powerloom/core": core, "./db": { getDb: () => db }, "./usage": { getUsageStore: () => usage },
    "./vaultRuns": { runInVault: () => undefined, vaultRunIds: async () => new Set(ids) },
  });
  const daily = await activity.loadDailyActivity(from, now, "synthetic");
  assert.equal(daily.reduce((sum: number, day: any) => sum + (day.costByAgent.worker ?? 0), 0), expected.costUsd);
  assert.equal(daily.reduce((sum: number, day: any) => sum + (day.tokensByAgent.worker ?? 0), 0), expected.tokens);
  assert.equal(daily.reduce((sum: number, day: any) => sum + (day.durationMsByAgent.worker ?? 0), 0), expected.durationMs);
  assert.ok(daily.some((day: any) => day.accountingComplete === false));
  const agent = (await activity.loadAgentActivity(from, "synthetic")).get("worker");
  assert.equal(agent.finishedRuns, expected.runs);
  assert.equal(agent.costUsd, expected.costUsd);
  assert.equal(agent.tokens, expected.tokens);
  assert.equal(agent.durationMs, expected.durationMs);
  assert.equal(agent.accountingComplete, false);
  assert.deepEqual(await core.loadRunTotals(usage, []), { runs: 0, tokens: 0, costUsd: 0, durationMs: 0 });
});
