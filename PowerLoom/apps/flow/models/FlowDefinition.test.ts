import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TRIGGER_NODE_ID, fromSavedDefinition, toSavedDefinition, withSteps, type SavedDefinition } from "./FlowDefinition";

const agents = new Map([
  ["planner", { label: "Planner", handles: ["planning", "research"] }],
  ["builder", { label: "Builder", handles: ["implementation"] }],
]);

const saved: SavedDefinition = {
  nodes: [
    { id: TRIGGER_NODE_ID, type: "trigger", position: { x: 40, y: 160 } },
    { id: "plan", type: "agent", agent: "planner", kind: "planning", title: "{kind} for {flow}", runs: 1, position: { x: 320, y: 80 } },
    { id: "build", type: "agent", agent: "builder", kind: "implementation", title: "Build it", runs: 3, position: { x: 600, y: 80 } },
  ],
  edges: [
    { id: "e1", from: TRIGGER_NODE_ID, to: "plan", kind: "required" },
    { id: "e2", from: "plan", to: "build", kind: "optional" },
  ],
};

describe("the canvas and the saved definition", () => {
  it("round-trip without losing a node, an edge, a kind or a position", () => {
    const canvas = fromSavedDefinition(saved, agents);

    assert.deepEqual(toSavedDefinition(canvas.nodes, canvas.edges), saved);
  });

  it("gives a node the palette's label and handles, and keeps a saved kind the agent no longer handles", () => {
    const { nodes } = fromSavedDefinition({ ...saved, nodes: [saved.nodes[0], { ...saved.nodes[1], kind: "design" } as SavedDefinition["nodes"][number]] }, agents);
    const plan = nodes[1];

    assert.equal(plan.type, "agent");
    if (plan.type !== "agent") return;
    assert.equal(plan.data.agentLabel, "Planner");
    assert.deepEqual(plan.data.handles, ["planning", "research", "design"]);
    assert.equal(nodes[0].deletable, false);
  });

  it("saves a blank title as the default template and at least one run", () => {
    const canvas = fromSavedDefinition(saved, agents);
    const nodes = canvas.nodes.map((node) => (node.type === "agent" ? { ...node, data: { ...node.data, titleTemplate: "  ", runs: 0 } } : node));
    const [, plan] = toSavedDefinition(nodes, canvas.edges).nodes;

    assert.equal(plan.type, "agent");
    if (plan.type !== "agent") return;
    assert.equal(plan.title, "{kind} for {flow}");
    assert.equal(plan.runs, 1);
  });

  it("puts the steps on the nodes and locks everything for the execution page", () => {
    const step = { nodeId: "plan", itemId: "XT-1-001", status: "done" as const, runs: 2, lastRunId: 7, agent: "planner", kind: "planning", taskUrl: "http://web/tasks/XT-1-001", runUrl: "http://web/agents/runs/7", agentUrl: "http://web/agents/planner" };
    const { nodes, edges } = withSteps(fromSavedDefinition(saved, agents), [step], "running");
    const [trigger, plan, build] = nodes;

    assert.deepEqual(trigger.data, { executionStatus: "running" });
    assert.equal(plan.type === "agent" ? plan.data.step?.itemId : null, "XT-1-001");
    assert.equal(build.type === "agent" ? build.data.step : null, undefined);
    assert.ok(nodes.every((node) => node.draggable === false));
    assert.ok(edges.every((edge) => edge.data?.locked === true));
  });
});
