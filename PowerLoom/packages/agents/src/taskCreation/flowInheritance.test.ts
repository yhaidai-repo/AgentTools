import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { commitCreatedTasks } from "./commitCreatedTasks";
import type { CreatedTask } from "./models/CreatedTask";
import type { TaskCommitContext } from "./models/TaskCommitContext";

// A task created inside a flow execution (PowerLoom Flow phase 2) inherits the creating task's execution and node; a
// task created outside one carries neither.
describe("commitCreatedTasks and flow executions", () => {
  const task: CreatedTask = {
    assignee: "research", kind: "task", title: "Check the record", goal: "Inspect the record", doneWhen: "A checked result is saved", outOfScope: null, effort: "trace", reason: "A decision depends on it",
    evidence: [], blocking: false, dependsOn: [], options: [], steps: [], docPath: null, handoff: null,
  } as unknown as CreatedTask;

  function fakeDb(saved: Record<string, any>[]): PowerLoomDb {
    return {
      execute: async () => ({ rows: [{ id: "AT-7-002" }] }),
      insert: (table: unknown) => ({ values: async (value: Record<string, any>) => { if (table === localItem) saved.push(value); } }),
    } as unknown as PowerLoomDb;
  }

  const context: TaskCommitContext = { pbiId: 7, vault: "work", docsVault: "work", parentTaskId: "XT-7-001", agent: "planner", runId: 11, depth: 0 };

  it("writes the parent's flow markers on what the run created", async () => {
    const saved: Record<string, any>[] = [];

    await commitCreatedTasks(fakeDb(saved), { ...context, flow: { flowExecutionId: "FX-001", flowNodeId: "plan" } }, [task, { ...task, assignee: "user", kind: "question", title: "Which tenant?" }]);

    assert.equal(saved.length, 2);
    assert.equal(saved[0].parentId, "XT-7-001");
    assert.equal(saved[0].data.flowExecutionId, "FX-001");
    assert.equal(saved[0].data.flowNodeId, "plan");
    assert.equal(saved[0].data.key, undefined);
    assert.equal(saved[1].kind, "question");
    assert.equal(saved[1].data.flowExecutionId, "FX-001");
    assert.equal(saved[1].data.flowNodeId, "plan");
  });

  it("writes no markers outside an execution", async () => {
    const saved: Record<string, any>[] = [];

    await commitCreatedTasks(fakeDb(saved), context, [task]);

    assert.equal(saved.length, 1);
    assert.equal("flowExecutionId" in saved[0].data, false);
    assert.equal("flowNodeId" in saved[0].data, false);
  });
});
