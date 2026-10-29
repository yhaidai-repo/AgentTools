import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { agentRun, implementationSnapshot, localItem, type PowerLoomDb } from "@powerloom/db";
import type { DuplicateGuard } from "../DuplicateGuard";
import { ReadLog } from "../evidence/ReadLog";
import { createHandOffTool } from "../handoff/handOffTool";
import type { TaskContext } from "../models/TaskContext";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { ImplementationWriter } from "./ImplementationWriter";
import type { RunBuildLog } from "../sandbox/models/RunBuildLog";
import type { SandboxBuildRun } from "../sandbox/models/SandboxBuildRun";
import type { BuildSource } from "./models/BuildSource";
import type { PreparedImplementation } from "./models/PreparedImplementation";

const LIMITS = { depth: 1, maxDepth: 3, maxPerRun: 5, maxPerPbi: 15, createdOnPbi: 0 };
const noDuplicates = { check: () => null, remember: () => undefined } as unknown as DuplicateGuard;
const WORKTREE = "/cache/.worktrees/demo/shop/powerloom-pbi-7";
const TASK = { id: "XT-7-001", pbiId: 7, vault: "demo", data: {} } as never;

const WORKSPACE = { repo: { name: "shop", remoteUrl: "https://example.invalid/shop", defaultBranch: "main" }, branch: "powerloom/pbi-7", baseBranch: "main", gsd: true };
const APPROVED: PreparedImplementation = { outcome: { kind: "approved", reviewId: "HT-7-002", planVersion: 2 }, workspace: WORKSPACE, commands: { build: null, test: "dotnet test" } };
const REPLAN: PreparedImplementation = { outcome: { kind: "replan", reviewId: "HT-7-002", reason: "HT-7-002 asked for changes", corrections: "changes: 30 days" }, workspace: null, commands: { build: null, test: null } };
const BLOCKED: PreparedImplementation = { outcome: { kind: "blocked", reason: "HT-7-002 was cancelled: the review never approved the plan." }, workspace: null, commands: { build: null, test: null } };

const BUILT: PreparedImplementation = { ...APPROVED, commands: { build: "dotnet build Shop.sln", test: "dotnet test Shop.sln" } };
const TESTED = { command: "dotnet test", exitCode: 0, problem: null, at: "2026-10-29T10:00:00.000Z" };

const SOURCE: BuildSource = {
  planning: {
    inspect: async () => ({ schema_version: 1, phases: [{ dir: "01-archive", phase_id: "01", verification: { status: "passed" }, uat: { unresolved: [] }, plans: [{ id: "01-01", file: "01-01-PLAN.md", hasSummary: true, tasks: [{ name: "a" }] }] }] }),
    read: async () => null,
  },
  commits: async () => [{ sha: "a1", message: "feat(01-01): archive expired orders" }],
  head: async () => "a1",
};

function step(action: string) {
  return { action, source: "other", resource: "The PBI branch's worktree", query: null, timeRange: null, reportBack: "done, or what you found" };
}

function baseHandOff(overrides: Record<string, unknown>) {
  return {
    to: "person", item: "task", intent: "review", gate: "none", title: "Review powerloom/pbi-7, push it and open the pull request",
    package: { body: "The plan is built on powerloom/pbi-7; verification passed.", results: [], items: [], notes: [] },
    goal: "The branch is reviewed, pushed and its pull request opened.", done_when: "the pull request is open", out_of_scope: null, effort: "lookup",
    reason: "The agent never pushes.", evidence: [{ source: "S0", ref: "PBI description", note: "orders past their expiry stay open" }],
    blocking: true, depends_on: [], options: [], steps: [step("Review the commits"), step("Push the branch and open the pull request")], doc_path: null,
    ...overrides,
  };
}

const HAND_OVER = baseHandOff({});
const PLANNING = baseHandOff({ to: "design", intent: "continue", title: "Plan again with the review's changes", steps: [], package: { body: "changes: 30 days", results: [], items: ["HT-7-002"], notes: [] } });

async function handedOff(...calls: Record<string, unknown>[]): Promise<CreatedTask[]> {
  const tasks: CreatedTask[] = [];
  const tool = createHandOffTool(["design"], tasks, noDuplicates, new ReadLog("orders past their expiry stay open"), LIMITS);

  for (const input of calls) {
    await tool.handler(input);
  }

  return tasks;
}

// Records inserts and updates per table, and the worktree holds; every select finds no earlier version.
function recordingDb() {
  const inserted: { table: unknown; values: any }[] = [];
  const updated: { table: unknown; changes: any }[] = [];
  const held: { path: string; reason: string }[] = [];
  const empty = { then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve([]).then(resolve) };
  const db = {
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => empty }) }) }) }),
    insert: (table: unknown) => ({ values: async (values: any) => { inserted.push({ table, values }); } }),
    update: (table: unknown) => ({ set: (changes: any) => ({ where: async () => { updated.push({ table, changes }); } }) }),
  } as unknown as PowerLoomDb;
  const repoCache = { holdWorktree: async (path: string, reason: string) => { held.push({ path, reason }); } };

  return { db, repoCache, inserted, updated, held };
}

function writerWith(db: PowerLoomDb, prepared: PreparedImplementation, log: RunBuildLog = restoredLog(TESTED), source: BuildSource = SOURCE): ImplementationWriter {
  const context = { deps: { db, runWorktree: { current: { repo: "shop", path: WORKTREE } }, runBuildLog: log } } as unknown as TaskContext;

  return new ImplementationWriter(context, () => source, async () => prepared);
}

// The run restored shop, then ran these builds and tests.
function restoredLog(...runs: SandboxBuildRun[]): RunBuildLog {
  return { runs, restores: [{ repo: "shop", ok: true, at: "2026-10-29T09:59:00.000Z" }] };
}

function sandboxRun(command: string, exitCode: number | null, problem: string | null = null): SandboxBuildRun {
  return { command, exitCode, problem, at: "2026-10-29T10:00:00.000Z" };
}

function targetOf(recorded: ReturnType<typeof recordingDb>, tasks: CreatedTask[]): WriterTarget {
  const taskIds = tasks.map((_task, index) => `XT-7-00${index + 2}`);
  const handoffs = tasks.map((task, index) => ({ intent: task.handoff!.intent, toItemId: taskIds[index] }));

  return { deps: { db: recorded.db, repoCache: recorded.repoCache }, task: TASK, runId: 52, agentId: "implementation", tasks, taskIds, handoffs, result: null, stoppedEarly: false } as unknown as WriterTarget;
}

async function writeImplementation(writer: ImplementationWriter): Promise<{ text: string; isError?: boolean }> {
  const [tool] = writer.tools(new ReadLog(""));

  return tool.handler({ summary: "Expired orders are archived nightly.", pr_title: "Archive expired orders", verdict: "phase 01 passed", checkpoints: [] });
}

describe("ImplementationWriter", () => {
  it("builds only an approved plan in its worktree, with the run's config kept", async () => {
    const recorded = recordingDb();
    const approved = writerWith(recorded.db, APPROVED);
    const replan = writerWith(recorded.db, REPLAN);

    const workspace = await approved.workspace(TASK);

    assert.deepEqual(workspace?.workspace, WORKSPACE);
    assert.equal((await workspace!.toolPolicy({ callId: "c", name: "Write", input: { file_path: ".planning/config.json" }, taskId: null, agentType: null })).allow, false);
    assert.equal(await replan.workspace(TASK), null);
    assert.match((await replan.contextBlocks(TASK))[0], /outcome="replan"/);
  });

  it("stores the build with its hand-over task, notes the branch on that task and holds the worktree until it closes", async () => {
    const recorded = recordingDb();
    const writer = writerWith(recorded.db, APPROVED);

    await writer.contextBlocks(TASK);
    assert.match((await writeImplementation(writer)).text, /Implementation saved: 1 of 1 plans done, 1 commits on powerloom\/pbi-7, hand-over ready\./);
    await writer.commit(targetOf(recorded, await handedOff(HAND_OVER)));

    const snapshot = recorded.inserted.find((entry) => entry.table === implementationSnapshot)?.values;
    const note = new PgDialect().sqlToQuery(recorded.updated.find((entry) => entry.table === localItem)?.changes.body).params;
    assert.deepEqual([snapshot.pbiId, snapshot.version, snapshot.schemaVersion, snapshot.planVersion, snapshot.runId], [7, 1, 1, 2, 52]);
    assert.deepEqual(snapshot.build.handOver, { state: "ready", verdict: "phase 01 passed", prTitle: "Archive expired orders", itemId: "XT-7-002" });
    assert.equal(snapshot.build.worktree, WORKTREE);
    assert.match(String(note[0]), /\*\*Branch:\*\* `powerloom\/pbi-7` in shop, from `main`, head `a1`, 1 local commits; nothing is pushed\./);
    assert.match(String(note[0]), /\*\*Title:\*\* Archive expired orders/);
    assert.deepEqual(recorded.held, [{ path: WORKTREE, reason: "PowerLoom: XT-7-002 (review the branch, push, open the pull request) keeps this worktree until it closes" }]);
    assert.ok(recorded.updated.some((entry) => entry.table === agentRun));
    assert.equal(writer.settlement(), null);
  });

  it("misses the build, then the hand-over, of an approved plan", async () => {
    const unbuilt = recordingDb();
    const unbuiltWriter = writerWith(unbuilt.db, APPROVED);
    const kept = recordingDb();
    const keptWriter = writerWith(kept.db, APPROVED);

    await unbuiltWriter.contextBlocks(TASK);
    await unbuiltWriter.commit(targetOf(unbuilt, []));
    await keptWriter.contextBlocks(TASK);
    await writeImplementation(keptWriter);
    await keptWriter.commit(targetOf(kept, []));

    assert.deepEqual(unbuiltWriter.settlement(), { kind: "missing", output: "the implementation (write_implementation)" });
    assert.deepEqual(keptWriter.settlement(), { kind: "missing", output: "the hand-over (hand_off to a person, intent review: review the branch, push it, open the pull request)" });
    assert.deepEqual(kept.held, []);
  });

  it("is settled by the planning task that takes the review's changes back, and refuses to record a build", async () => {
    const recorded = recordingDb();
    const writer = writerWith(recorded.db, REPLAN);
    const silent = writerWith(recorded.db, REPLAN);

    await writer.contextBlocks(TASK);
    await silent.contextBlocks(TASK);
    const refused = await writeImplementation(writer);
    await writer.commit(targetOf(recorded, await handedOff(PLANNING)));
    await silent.commit(targetOf(recorded, []));

    assert.deepEqual(refused, { text: "Not saved: this run has no worktree to build in.", isError: true });
    assert.equal(writer.settlement(), null);
    assert.deepEqual(silent.settlement(), { kind: "missing", output: "the planning task (hand_off to design, intent continue, with the review's changes)" });
  });

  it("blocks the task for a person when the review never approved, whatever the run handed off", async () => {
    const recorded = recordingDb();
    const writer = writerWith(recorded.db, BLOCKED);

    await writer.contextBlocks(TASK);
    await writer.commit(targetOf(recorded, await handedOff(PLANNING)));

    assert.deepEqual(writer.settlement(), { kind: "blocked", reason: "HT-7-002 was cancelled: the review never approved the plan." });
  });

  it("saves nothing while the repo's build command never passed or its test never ran in the run's sandbox", async () => {
    const recorded = recordingDb();
    const restoreFailed = sandboxRun("dotnet build Shop.sln", 1, "The package restore before it did not fully succeed: NU1301 Unable to load the service index");
    const unbuilt = writerWith(recorded.db, BUILT, { runs: [], restores: [] });
    const red = writerWith(recorded.db, BUILT, restoredLog(restoreFailed));
    const untested = writerWith(recorded.db, BUILT, restoredLog(sandboxRun("dotnet build Shop.sln", 0)));
    const fixed = writerWith(recorded.db, BUILT, restoredLog(restoreFailed, sandboxRun("cd src && dotnet build Shop.sln", 0), sandboxRun("dotnet test Shop.sln --no-build", 0)));

    for (const writer of [unbuilt, red, untested, fixed]) {
      await writer.contextBlocks(TASK);
    }

    const refusals = [await writeImplementation(unbuilt), await writeImplementation(red), await writeImplementation(untested)];
    const saved = await writeImplementation(fixed);

    assert.ok(refusals.every((refusal) => refusal.isError));
    assert.match(refusals[0].text, /^Not saved: no build ran in this run's sandbox \(the repo's build command: `dotnet build Shop\.sln`\)\.\nNo sandbox_restore of shop ran in this run: restore first .*\nRun the build command in Bash/);
    assert.doesNotMatch(refusals[1].text, /No sandbox_restore/);
    assert.match(refusals[1].text, /^Not saved: the last build did not pass: `dotnet build Shop\.sln` failed with exit code 1 \(The package restore before it did not fully succeed: NU1301/);
    assert.match(refusals[1].text, /end with write_result, status blocked, quoting the exact error\. What an earlier conversation said about a feed or the sandbox is no reason/);
    assert.match(refusals[2].text, /^Not saved: no test ran in this run's sandbox \(the repo's test command: `dotnet test Shop\.sln`\)/);
    assert.match(saved.text, /\nBuild: `cd src && dotnet build Shop\.sln` passed; test `dotnet test Shop\.sln --no-build` passed\.\n/);
    assert.equal(fixed.settlement()?.kind, "missing");
  });

  it("saves nothing when GSD finished no plan, whatever was committed by hand", async () => {
    const recorded = recordingDb();
    const handEdited: BuildSource = {
      ...SOURCE,
      planning: { ...SOURCE.planning, inspect: async () => ({ schema_version: 1, phases: [{ dir: "01-archive", phase_id: "01", uat: { unresolved: [] }, plans: [{ id: "01-01", file: "01-01-PLAN.md", hasSummary: false, tasks: [{ name: "a" }] }, { id: "01-02", file: "01-02-PLAN.md", hasSummary: false, tasks: [{ name: "b" }] }] }] }) },
    };
    const writer = writerWith(recorded.db, BUILT, restoredLog(sandboxRun("dotnet build Shop.sln", 0), sandboxRun("dotnet test Shop.sln", 0)), handEdited);

    await writer.contextBlocks(TASK);
    const refused = await writeImplementation(writer);
    await writer.commit(targetOf(recorded, []));

    assert.equal(refused.isError, true);
    assert.match(refused.text, /^Not saved: 0 of 2 plans are done\.\nRun Skill gsd-execute-phase for each phase with plans not done/);
    assert.deepEqual(writer.settlement(), { kind: "missing", output: "the implementation (write_implementation)" });
  });

  it("hands over unbuilt when no build command is configured, naming the missing setting, and a failing test leaves gaps", async () => {
    const recorded = recordingDb();
    const writer = writerWith(recorded.db, APPROVED, restoredLog(sandboxRun("dotnet test", 1)));

    await writer.contextBlocks(TASK);
    const saved = await writeImplementation(writer);
    await writer.commit(targetOf(recorded, await handedOff(HAND_OVER)));

    const note = new PgDialect().sqlToQuery(recorded.updated.find((entry) => entry.table === localItem)?.changes.body).params;
    assert.match(saved.text, /hand-over gaps\.\nBuild: not built: shop has no build command \(set it under Settings → Repositories, or with repo_saveCommands\); test `dotnet test` failed with exit code 1\./);
    assert.match(String(note[0]), /\*\*Build in the sandbox:\*\* not built: shop has no build command/);
    assert.match((await writer.contextBlocks(TASK))[0], /No build command is configured for this repo/);
    assert.equal(writer.settlement(), null);
  });
});
