import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { followUpOf } from "../betterRefinement/commitBetterRefinement";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import { followUpDependsOn } from "./refinementFollowUp";

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
});
