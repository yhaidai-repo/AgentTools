import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { agentRun, localItem, planningSnapshot, type PowerLoomDb } from "@powerloom/db";
import type { DuplicateGuard } from "../DuplicateGuard";
import { ReadLog } from "../evidence/ReadLog";
import { createHandOffTool } from "../handoff/handOffTool";
import type { TaskContext } from "../models/TaskContext";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { MISSING_IMPLEMENTER_NOTE } from "./commitPlan";
import type { PlanningFolder } from "./models/PlanningFolder";
import { PlanWriter } from "./PlanWriter";

const LIMITS = { depth: 1, maxDepth: 3, maxPerRun: 5, maxPerPbi: 15, createdOnPbi: 0 };
const noDuplicates = { check: () => null, remember: () => undefined } as unknown as DuplicateGuard;

const INSPECT = {
  schema_version: 1,
  phases: [{ dir: "01-archive", phase_id: "01", plans: [{ id: "01-01", file: "01-01-PLAN.md", wave: 1, tasks: [] }] }],
  requirements: [{ id: "ORD-01", text: "Expired orders are archived.", complete: false }],
};

const FOLDER: PlanningFolder = {
  inspect: async () => INSPECT,
  read: async (path) => (path.endsWith("PLAN.md") ? "---\nrequirements: [ORD-01]\n---\n" : null),
};

function baseHandOff(overrides: Record<string, unknown>) {
  return {
    to: "person", item: "task", intent: "review", gate: "approve", title: "Review the plan for expired orders",
    package: { body: "The plan archives expired orders (plan 01-01).", results: [], items: [], notes: [] },
    goal: "Approve the plan or name the changes.", done_when: "approve, or the changes to make", out_of_scope: null, effort: "lookup",
    reason: "Implementation starts only on an approved plan.", evidence: [{ source: "S0", ref: "PBI description", note: "orders past their expiry stay open" }],
    blocking: true, depends_on: [], options: [], steps: [], doc_path: null,
    ...overrides,
  };
}

const REVIEW = baseHandOff({});
const IMPLEMENT = baseHandOff({ to: "implement", intent: "continue", gate: "none", title: "Implement the plan", depends_on: ["new:1"] });
const QUESTION = baseHandOff({ item: "question", intent: "ask", gate: "none", title: "Archive after how many days?", options: ["30", "90"] });

// The hand_off calls of a run, as the tool records them.
async function handedOff(...calls: Record<string, unknown>[]): Promise<CreatedTask[]> {
  const tasks: CreatedTask[] = [];
  const tool = createHandOffTool(["implement"], tasks, noDuplicates, new ReadLog("orders past their expiry stay open"), LIMITS);

  for (const input of calls) {
    await tool.handler(input);
  }

  return tasks;
}

// Records inserts and updates per table; every select finds no earlier version.
function recordingDb() {
  const inserted: { table: unknown; values: any }[] = [];
  const updated: { table: unknown; changes: any }[] = [];
  const empty = { then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve([]).then(resolve) };
  const db = {
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => empty }) }) }) }),
    insert: (table: unknown) => ({ values: async (values: any) => { inserted.push({ table, values }); } }),
    update: (table: unknown) => ({ set: (changes: any) => ({ where: async () => { updated.push({ table, changes }); } }) }),
  } as unknown as PowerLoomDb;

  return { db, inserted, updated };
}

function writerWith(db: PowerLoomDb, worktree: string | null = "D:/worktrees/shop/powerloom-pbi-7"): PlanWriter {
  const context = { deps: { db, runWorktree: { current: worktree ? { repo: "shop", path: worktree } : null } } } as unknown as TaskContext;

  return new PlanWriter(context, () => FOLDER);
}

function targetOf(db: PowerLoomDb, tasks: CreatedTask[]): WriterTarget {
  const taskIds = tasks.map((_task, index) => `XT-7-00${index + 1}`);
  const handoffs = tasks.map((task, index) => ({ intent: task.handoff!.intent, toItemId: taskIds[index] }));

  return { deps: { db }, task: { id: "DT-7-001", pbiId: 7, vault: "demo", data: {} }, runId: 41, agentId: "planning", tasks, taskIds, handoffs, result: null, stoppedEarly: false } as unknown as WriterTarget;
}

async function writePlan(writer: PlanWriter): Promise<{ text: string; isError?: boolean }> {
  const [tool] = writer.tools(new ReadLog(""));

  return tool.handler({ summary: "Archive expired orders nightly.", checker_verdict: "passed", checker_issues: [], assumptions: [] });
}

describe("PlanWriter", () => {
  it("stores the plan as the PBI's next version with its inspect snapshot", async () => {
    const { db, inserted, updated } = recordingDb();
    const writer = writerWith(db);

    assert.match((await writePlan(writer)).text, /Plan saved: 1 plans, 0 decisions, 1 requirements\./);
    await writer.commit(targetOf(db, await handedOff(REVIEW, IMPLEMENT)));

    const snapshot = inserted.find((entry) => entry.table === planningSnapshot)?.values;
    assert.deepEqual([snapshot.pbiId, snapshot.version, snapshot.schemaVersion, snapshot.runId, snapshot.inspect], [7, 1, 1, 41, INSPECT]);
    assert.deepEqual(snapshot.plan.requirements, [{ id: "ORD-01", text: "Expired orders are archived.", complete: false, plans: ["01-01"] }]);
    assert.ok(updated.some((entry) => entry.table === agentRun));
  });

  it("is settled by the gated review and the implementation task behind it, which gets the missing-agent note", async () => {
    const { db, updated } = recordingDb();
    const writer = writerWith(db);
    const tasks = await handedOff(REVIEW, IMPLEMENT);

    await writePlan(writer);
    await writer.commit(targetOf(db, tasks));

    assert.equal(writer.settlement(), null);
    assert.equal(tasks[0].steps.length, 2);
    assert.match(tasks[0].steps[0].reportBack, /`approve`, or `changes: <what to change>`/);
    const note = updated.find((entry) => entry.table === localItem)?.changes.body;
    assert.ok(new PgDialect().sqlToQuery(note).params.includes(MISSING_IMPLEMENTER_NOTE));
  });

  it("misses the review when a plan was written without one", async () => {
    const { db } = recordingDb();
    const writer = writerWith(db);

    await writePlan(writer);
    await writer.commit(targetOf(db, await handedOff(IMPLEMENT)));

    assert.deepEqual(writer.settlement(), { kind: "missing", output: "the plan review (hand_off to a person, intent review, gate approve)" });
  });

  it("misses the implementation task when it doesn't wait for the review", async () => {
    const { db } = recordingDb();
    const writer = writerWith(db);

    await writePlan(writer);
    await writer.commit(targetOf(db, await handedOff(REVIEW, { ...IMPLEMENT, depends_on: [] })));

    assert.deepEqual(writer.settlement(), { kind: "missing", output: "the implementation task (hand_off to implement, depends_on the review)" });
  });

  it("leaves a run without a plan to the questions it asked, and misses the plan without them", async () => {
    const asked = recordingDb();
    const askingWriter = writerWith(asked.db);
    const silent = recordingDb();
    const silentWriter = writerWith(silent.db);

    await askingWriter.commit(targetOf(asked.db, await handedOff(QUESTION)));
    await silentWriter.commit(targetOf(silent.db, []));

    assert.equal(askingWriter.settlement(), null);
    assert.equal(asked.inserted.some((entry) => entry.table === planningSnapshot), false);
    assert.deepEqual(silentWriter.settlement(), { kind: "missing", output: "a plan (write_plan) or the questions that stop it (hand_off to a person, intent ask)" });
  });

  it("refuses write_plan in a run without a worktree", async () => {
    const { db } = recordingDb();
    const result = await writePlan(writerWith(db, null));

    assert.deepEqual(result, { text: "Not saved: this run has no worktree with a .planning/ folder.", isError: true });
  });
});
