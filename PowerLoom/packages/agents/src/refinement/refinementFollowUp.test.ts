import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handoff, localItem, type PowerLoomDb } from "@powerloom/db";
import { followUpOf } from "../betterRefinement/commitBetterRefinement";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import { followUpDependsOn, handOnRefinement } from "./refinementFollowUp";

const RUN = { pbiId: 30474, runId: 1438, taskId: "RT-30474-001" };

describe("refinement follow-up", () => {
  it("waits for the user's items and the run's research when the run handed work to the user", () => {
    const dependsOn = followUpDependsOn({ ...RUN, userItemIds: ["Q-30474-001", "HT-30474-002"], agentItemIds: ["AT-30474-001"], designQueued: false });

    assert.deepEqual(dependsOn, ["Q-30474-001", "HT-30474-002", "AT-30474-001"]);
  });

  it("is not needed without user items or when the run queued design", () => {
    assert.deepEqual(followUpDependsOn({ ...RUN, userItemIds: [], agentItemIds: ["AT-30474-001"], designQueued: false }), []);
    assert.deepEqual(followUpDependsOn({ ...RUN, userItemIds: ["Q-30474-001"], agentItemIds: [], designQueued: true }), []);
  });

  it("takes Better Refinement's created tasks by assignee, in their committed order", () => {
    const tasks = [{ assignee: "user" }, { assignee: "research" }, { assignee: "user" }, { assignee: "docs" }] as CreatedTask[];

    const followUp = followUpOf({ id: RUN.taskId, pbiId: RUN.pbiId }, RUN.runId, tasks, ["Q-30474-001", "AT-30474-001", "HT-30474-002", "WT-007"]);

    assert.deepEqual({ users: followUp.userItemIds, agents: followUp.agentItemIds, design: followUp.designQueued }, { users: ["Q-30474-001", "HT-30474-002"], agents: ["AT-30474-001"], design: false });
  });

  it("hands the work on to a new follow-up with a continue hand-off, or to the refinement already open", async () => {
    const followUp = { ...RUN, userItemIds: ["Q-30474-001"], agentItemIds: [], designQueued: false };
    const fresh = refinementDb(null);
    const open = refinementDb("RT-30474-009");

    assert.equal(await handOnRefinement(fresh.db, followUp, "better-refinement", 3), "RT-30474-002");
    assert.equal(await handOnRefinement(open.db, followUp, "better-refinement", 3), null);
    assert.deepEqual(fresh.handoffs.map((row) => [row.fromTaskId, row.toItemId, row.intent, row.refs.items]), [["RT-30474-001", "RT-30474-002", "continue", ["Q-30474-001"]]]);
    assert.deepEqual(open.handoffs.map((row) => [row.toItemId, row.intent]), [["RT-30474-009", "continue"]]);
    assert.equal(open.items.length, 0);
  });

  it("hands nothing on when no follow-up is needed", async () => {
    const none = refinementDb(null);

    assert.equal(await handOnRefinement(none.db, { ...RUN, userItemIds: [], agentItemIds: [], designQueued: false }, "better-refinement", 3), null);
    assert.equal(none.handoffs.length, 0);
  });
});

// Answers the open-refinement lookup with `openId`, numbers a new follow-up RT-30474-002, records inserts per table.
function refinementDb(openId: string | null) {
  const items: Record<string, any>[] = [];
  const handoffs: Record<string, any>[] = [];
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (openId ? [{ id: openId }] : []) }) }) }),
    execute: async () => ({ rows: [{ id: "RT-30474-002" }] }),
    insert: (table: unknown) => ({ values: async (value: Record<string, any>) => {
      (table === handoff ? handoffs : table === localItem ? items : []).push(value);
    } }),
  } as unknown as PowerLoomDb;

  return { db, items, handoffs };
}
