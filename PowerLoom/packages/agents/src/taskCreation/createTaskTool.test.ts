import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import type { DuplicateGuard } from "../DuplicateGuard";
import { ReadLog } from "../evidence/ReadLog";
import { createTaskTool } from "./createTaskTool";
import type { CreatedTask } from "./models/CreatedTask";
import type { TaskCreationLimits } from "./models/TaskCreationLimits";

const LIMITS: TaskCreationLimits = { depth: 1, maxDepth: 3, maxPerRun: 5, maxPerPbi: 15, createdOnPbi: 0 };
const EVIDENCE = [{ source: "S0", ref: "PBI description", note: "the symptom as reported" }];

const noDuplicates = { check: () => null, remember: () => undefined } as unknown as DuplicateGuard;

function setup(limits: Partial<TaskCreationLimits> = {}, canAssign = ["research", "docs"]) {
  const tasks: CreatedTask[] = [];
  const tool = createTaskTool(canAssign, tasks, noDuplicates, new ReadLog("PBI 34881: expired catalog stay in the grid"), { ...LIMITS, ...limits });

  return { tasks, tool };
}

function researchTask(overrides: Record<string, unknown> = {}) {
  return {
    assignee: "research",
    kind: "task",
    title: "Why do expired catalog stay active?",
    goal: "The grid shows catalog past their ExpirationDate.",
    done_when: "The writer that should archive them is named, with evidence.",
    out_of_scope: null,
    effort: "trace",
    reason: "The fix depends on the cause.",
    evidence: EVIDENCE,
    blocking: true,
    depends_on: [],
    options: [],
    steps: [],
    doc_path: null,
    ...overrides,
  };
}

const userStep = { action: "Check the container's TTL", source: "portal", resource: "Cosmos zz-stage (stage)", query: null, timeRange: null, reportBack: "The TTL value" };

describe("create_task", () => {
  it("notes an agent task with its decision fields", async () => {
    const { tasks, tool } = setup();

    const result = await tool.handler(researchTask());

    assert.equal(result.text, "Noted as new:1 for research; it is created when your run succeeds.");
    assert.equal(tasks.length, 1);
    assert.deepEqual({ assignee: tasks[0].assignee, doneWhen: tasks[0].doneWhen, blocking: tasks[0].blocking, evidence: tasks[0].evidence }, { assignee: "research", doneWhen: "The writer that should archive them is named, with evidence.", blocking: true, evidence: EVIDENCE });
  });

  it("offers only the task types the config allows, and the user", () => {
    const { tool } = setup({}, ["research"]);
    const input = z.object(tool.input);

    assert.equal(input.safeParse(researchTask()).success, true);
    assert.equal(input.safeParse(researchTask({ assignee: "user", kind: "question" })).success, true);
    assert.equal(input.safeParse(researchTask({ assignee: "design" })).success, false);
    assert.equal(input.safeParse(researchTask({ assignee: "refinement" })).success, false);
  });

  it("rejects a question for an agent, a user task without steps and a docs task without a note", async () => {
    const { tasks, tool } = setup();

    const question = await tool.handler(researchTask({ kind: "question" }));
    const userTask = await tool.handler(researchTask({ assignee: "user" }));
    const docs = await tool.handler(researchTask({ assignee: "docs" }));

    assert.match(question.text, /a question goes to the user/);
    assert.match(userTask.text, /a task for the user needs steps/);
    assert.match(docs.text, /docs needs doc_path/);
    assert.equal(tasks.length, 0);
  });

  it("rejects evidence from a source the run never read", async () => {
    const { tool } = setup();

    const result = await tool.handler(researchTask({ evidence: [{ source: "S4", ref: "POS/src/Invented.cs", note: "made up" }] }));

    assert.equal(result.isError, true);
    assert.match(result.text, /cites S4, which this run never read/);
  });

  it("accepts a dependency on a task created earlier in the run, not on a later one", async () => {
    const { tasks, tool } = setup();

    await tool.handler(researchTask());

    const later = await tool.handler(researchTask({ title: "Design", goal: "Plan the fix.", depends_on: ["new:2"] }));
    const earlier = await tool.handler(researchTask({ title: "Count", goal: "How many catalog are affected?", depends_on: ["new:1", "Q-34881-001"] }));

    assert.match(later.text, /depends_on "new:2" is neither/);
    assert.equal(earlier.isError, undefined);
    assert.deepEqual(tasks[1].dependsOn, ["new:1", "Q-34881-001"]);
  });

  it("stops agent tasks at the depth and per-PBI caps but still lets the user get one", async () => {
    const atDepth = setup({ depth: 3 });
    const atPbiCap = setup({ createdOnPbi: 15 });

    const deep = await atDepth.tool.handler(researchTask());
    const capped = await atPbiCap.tool.handler(researchTask());
    const toUser = await atPbiCap.tool.handler(researchTask({ assignee: "user", steps: [userStep] }));

    assert.match(deep.text, /depth limit 3 reached/);
    assert.match(capped.text, /agents already created 15 tasks on this PBI \(cap 15\)/);
    assert.equal(toUser.isError, undefined);
  });

  it("stops at the per-run cap", async () => {
    const { tool } = setup({ maxPerRun: 1 });

    await tool.handler(researchTask());

    const second = await tool.handler(researchTask({ goal: "Another question" }));

    assert.match(second.text, /at most 1 agent tasks per run/);
  });
});
