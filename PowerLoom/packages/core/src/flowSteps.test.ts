import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flowMarkersOf, flowStepsOf, type FlowTaskRow } from "./flowSteps";
import { TRIGGER_NODE_ID, type FlowDefinition } from "./models/FlowDefinition";

// trigger → plan (required) → build (required) → review (optional); build → docs (optional).
const definition: FlowDefinition = {
  nodes: [
    { id: TRIGGER_NODE_ID, type: "trigger", position: { x: 0, y: 0 } },
    { id: "plan", type: "agent", agent: "planner", kind: "planning", title: "Plan", position: { x: 1, y: 0 } },
    { id: "build", type: "agent", agent: "builder", kind: "implementation", title: "Build", position: { x: 2, y: 0 } },
    { id: "review", type: "agent", agent: "reviewer", kind: "review", title: "Review", position: { x: 3, y: 0 } },
    { id: "docs", type: "agent", agent: "writer", kind: "docs", title: "Docs", position: { x: 3, y: 1 } },
  ],
  edges: [
    { id: "e1", from: TRIGGER_NODE_ID, to: "plan", kind: "required" },
    { id: "e2", from: "plan", to: "build", kind: "required" },
    { id: "e3", from: "build", to: "review", kind: "optional" },
    { id: "e4", from: "build", to: "docs", kind: "optional" },
  ],
};

function task(id: string, kind: string, status: FlowTaskRow["status"], data: Record<string, unknown>, options: Partial<FlowTaskRow> = {}): FlowTaskRow {
  return { id, kind, status, assignee: "agent:someone", parentId: null, data, runs: 0, ...options };
}

// The steps mirror the backend's FlowSteps: the engine's task by its key, an agent-created task for an optional-only
// node by kind and parent, "pending" while running, "skipped" once finished.
describe("flowStepsOf", () => {
  it("shows the engine's task of each node and pending for the rest while running", () => {
    const tasks = [task("XT-1-001", "planning", "done", { flowExecutionId: "FX-001", flowNodeId: "plan", key: "FX-001:plan" }, { assignee: "agent:planner", runs: 2 })];

    assert.deepEqual(flowStepsOf("FX-001", "running", definition, tasks), [
      { nodeId: "plan", itemId: "XT-1-001", status: "done", runs: 2, agent: "planner", kind: "planning" },
      { nodeId: "build", itemId: null, status: "pending", runs: 0, agent: "builder", kind: "implementation" },
      { nodeId: "review", itemId: null, status: "pending", runs: 0, agent: "reviewer", kind: "review" },
      { nodeId: "docs", itemId: null, status: "pending", runs: 0, agent: "writer", kind: "docs" },
    ]);
  });

  it("attributes an agent-created task to the optional-only node of its kind under its parent, and skips the others once finished", () => {
    const tasks = [
      task("XT-1-001", "planning", "done", { flowExecutionId: "FX-001", flowNodeId: "plan", key: "FX-001:plan" }, { runs: 1 }),
      task("XT-1-002", "implementation", "done", { flowExecutionId: "FX-001", flowNodeId: "build", key: "FX-001:build" }, { runs: 1 }),
      // Created by the builder's run inside the execution: no key, the parent's markers.
      task("XT-1-003", "review", "open", { flowExecutionId: "FX-001", flowNodeId: "build" }, { parentId: "XT-1-002", assignee: "agent:*" }),
      // Another execution's task of the same kind doesn't count.
      task("XT-1-004", "docs", "done", { flowExecutionId: "FX-002", flowNodeId: "build" }, { parentId: "XT-1-009" }),
    ];

    assert.deepEqual(flowStepsOf("FX-001", "done", definition, tasks).map((step) => [step.nodeId, step.itemId, step.status, step.agent]), [
      ["plan", "XT-1-001", "done", "someone"],
      ["build", "XT-1-002", "done", "someone"],
      ["review", "XT-1-003", "open", "reviewer"],
      ["docs", null, "skipped", "writer"],
    ]);
  });
});

describe("flowMarkersOf", () => {
  it("reads both markers or nothing", () => {
    assert.deepEqual(flowMarkersOf({ flowExecutionId: "FX-001", flowNodeId: "plan", key: "FX-001:plan" }), { flowExecutionId: "FX-001", flowNodeId: "plan" });
    assert.equal(flowMarkersOf({ flowExecutionId: "FX-001" }), null);
    assert.equal(flowMarkersOf(null), null);
  });
});
