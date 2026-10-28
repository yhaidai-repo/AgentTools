import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handoff, localItem, type PowerLoomDb } from "@powerloom/db";
import { z } from "zod";
import type { DuplicateGuard } from "../DuplicateGuard";
import { ReadLog } from "../evidence/ReadLog";
import { commitCreatedTasks } from "../taskCreation/commitCreatedTasks";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import type { TaskCreationLimits } from "../taskCreation/models/TaskCreationLimits";
import { createHandOffTool } from "./handOffTool";

const LIMITS: TaskCreationLimits = { depth: 1, maxDepth: 3, maxPerRun: 5, maxPerPbi: 15, createdOnPbi: 0 };
const noDuplicates = { check: () => null, remember: () => undefined } as unknown as DuplicateGuard;
const userStep = { action: "Check the container's TTL", source: "portal", resource: "Cosmos zz-stage (stage)", query: null, timeRange: null, reportBack: "The TTL value" };

function setup(limits: Partial<TaskCreationLimits> = {}, canAssign = ["research", "implement"]) {
  const tasks: CreatedTask[] = [];
  const tool = createHandOffTool(canAssign, tasks, noDuplicates, new ReadLog("PBI 34881: expired orders stay open"), { ...LIMITS, ...limits });

  return { tasks, tool };
}

function handOff(overrides: Record<string, unknown> = {}) {
  return {
    to: "person",
    item: "task",
    intent: "review",
    gate: "approve",
    title: "Review the plan for expired orders",
    package: { body: "The plan archives orders past their expiry (step 2).", results: ["RUN-812"], items: [], notes: ["shop/orders/expiry.md"] },
    goal: "Approve the plan or name the changes.",
    done_when: "approve, or the changes to make",
    out_of_scope: null,
    effort: "lookup",
    reason: "Implementation starts only on an approved plan.",
    evidence: [{ source: "S0", ref: "PBI description", note: "orders past their expiry stay open" }],
    blocking: true,
    depends_on: [],
    options: [],
    steps: [],
    doc_path: null,
    ...overrides,
  };
}

// Records what the commit inserts, per table; ids come from the item id function.
function recordingDb() {
  const items: Record<string, any>[] = [];
  const handoffs: Record<string, any>[] = [];
  let sequence = 0;
  const db = {
    execute: async () => ({ rows: [{ id: `ID-${++sequence}` }] }),
    insert: (table: unknown) => ({ values: async (value: Record<string, any>) => {
      (table === handoff ? handoffs : table === localItem ? items : []).push(value);
    } }),
  } as unknown as PowerLoomDb;

  return { db, items, handoffs };
}

const CONTEXT = { pbiId: null, vault: "demo", docsVault: "demo", parentTaskId: "PT-1", agent: "planning", runId: 812, depth: 1 };

describe("hand_off", () => {
  it("offers a person and the task types the config allows", () => {
    const { tool } = setup({}, ["implement"]);
    const input = z.object(tool.input);

    assert.equal(input.safeParse(handOff()).success, true);
    assert.equal(input.safeParse(handOff({ to: "implement", intent: "continue", gate: "none" })).success, true);
    assert.equal(input.safeParse(handOff({ to: "research" })).success, false);
  });

  it("gives a review with gate approve the fixed answers", async () => {
    const { tasks, tool } = setup();

    const result = await tool.handler(handOff());

    assert.equal(result.text, "Noted as new:1 for user; it is created when your run succeeds.");
    assert.deepEqual(tasks[0].steps.map((step) => step.reportBack), ["`approve`, or `changes: <what to change>`", "`ok`, or your corrections"]);
    assert.deepEqual(tasks[0].handoff, { intent: "review", gate: "approve", package: { body: "The plan archives orders past their expiry (step 2).", refs: { results: ["RUN-812"], items: [], notes: ["shop/orders/expiry.md"] } } });
  });

  it("refuses a gate approve that isn't a person's review, or that brings its own steps", async () => {
    const { tasks, tool } = setup();

    const toAgent = await tool.handler(handOff({ to: "implement", intent: "continue" }));
    const asQuestion = await tool.handler(handOff({ item: "question" }));
    const ownSteps = await tool.handler(handOff({ steps: [userStep] }));

    assert.match(toAgent.text, /gate approve needs to: person, item: task, intent: review/);
    assert.match(asQuestion.text, /gate approve needs to: person, item: task, intent: review/);
    assert.match(ownSteps.text, /gate approve has fixed answers/);
    assert.equal(tasks.length, 0);
  });

  it("refuses a review or a gate answer for an agent, a question for an agent and a person's task without steps", async () => {
    const { tool } = setup();

    const review = await tool.handler(handOff({ to: "research", gate: "none" }));
    const answer = await tool.handler(handOff({ to: "research", intent: "ask", gate: "answer" }));
    const question = await tool.handler(handOff({ to: "research", item: "question", intent: "ask", gate: "none" }));
    const noSteps = await tool.handler(handOff({ intent: "ask", gate: "none" }));

    assert.match(review.text, /a review goes to a person/);
    assert.match(answer.text, /gate answer is for a person's question or task/);
    assert.match(question.text, /a question goes to the user/);
    assert.match(noSteps.text, /a task for the user needs steps/);
  });

  it("refuses package refs that aren't runs, item ids or earlier new:<n>", async () => {
    const { tool } = setup();

    const result = await tool.handler(handOff({ package: { body: "x", results: ["812"], items: ["new:1", "Q-1-001"], notes: [] } }));

    assert.match(result.text, /package result "812" is not RUN-<id>/);
    assert.match(result.text, /package item "new:1" is neither/);
    assert.doesNotMatch(result.text, /Q-1-001/);
  });

  it("caps agent targets but never a person", async () => {
    const { tool } = setup({ depth: 3 });

    const toAgent = await tool.handler(handOff({ to: "research", intent: "ask", gate: "none" }));
    const toPerson = await tool.handler(handOff({ intent: "ask", gate: "answer", item: "question" }));

    assert.match(toAgent.text, /depth limit 3 reached/);
    assert.equal(toPerson.isError, undefined);
  });

  it("commits a review chain: the gated human task, its hand-off, and the implementation task that depends on it", async () => {
    const { tasks, tool } = setup();
    const { db, items, handoffs } = recordingDb();

    await tool.handler(handOff());
    await tool.handler(handOff({ to: "implement", intent: "continue", gate: "none", title: "Implement the plan", package: { body: "Implement the approved plan.", results: [], items: ["new:1"], notes: [] }, depends_on: ["new:1"] }));

    const ids = await commitCreatedTasks(db, CONTEXT, tasks);

    assert.deepEqual(ids, ["ID-1", "ID-2"]);
    assert.equal(items[0].kind, "human");
    assert.match(items[0].body, /^\*\*Handed off by\*\* PT-1 \(planning, RUN-812\): review the sender's output/);
    assert.match(items[0].body, /### Step 1: Review "Review the plan for expired orders" and decide/);
    assert.match(items[0].body, /Read: Results RUN-812; Notes shop\/orders\/expiry\.md/);
    assert.deepEqual(items[1].data.dependsOn, ["ID-1"]);
    assert.deepEqual(handoffs.map((row) => [row.fromTaskId, row.fromAgent, row.fromRunId, row.toKind, row.toItemId, row.intent, row.gate]), [
      ["PT-1", "planning", 812, "human", "ID-1", "review", "approve"],
      ["PT-1", "planning", 812, "agent", "ID-2", "continue", "none"],
    ]);
    assert.deepEqual(handoffs[1].refs.items, ["ID-1"]);
  });

  it("gives a question for a person the package with the question, as a human task gets it", async () => {
    const { tasks, tool } = setup();
    const { db, items } = recordingDb();

    await tool.handler(handOff({ item: "question", intent: "ask", gate: "answer", goal: "Archive after 7 or 30 days?", options: ["7 days", "30 days"] }));
    await commitCreatedTasks(db, CONTEXT, tasks);

    assert.equal(items[0].kind, "question");
    assert.match(items[0].body, /^\*\*Handed off by\*\* PT-1 \(planning, RUN-812\): answer this; the sender waits for it and runs again\.\n\nThe plan archives orders past their expiry \(step 2\)\.[\s\S]*\n\n\*\*Question:\*\* Archive after 7 or 30 days\?$/);
  });
});
