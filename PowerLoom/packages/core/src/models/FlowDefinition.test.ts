import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TRIGGER_NODE_ID, agentNodesOf, flowDefinitionProblems, flowDefinitionSchema, type FlowDefinition } from "./FlowDefinition";

const trigger = { id: TRIGGER_NODE_ID, type: "trigger", position: { x: 40, y: 160 } } as const;
const plan = { id: "plan", type: "agent", agent: "planner", kind: "planning", title: "{kind} for {flow}", position: { x: 320, y: 80 } } as const;
const build = { id: "build", type: "agent", agent: "builder", kind: "implementation", title: "Build it", runs: 3, position: { x: 600, y: 80 } } as const;

function flow(edges: FlowDefinition["edges"], nodes: FlowDefinition["nodes"] = [trigger, plan, build]): FlowDefinition {
  return { nodes, edges };
}

// The contract PowerLoom's FlowDefinitionRules mirror (phase 1 of the flow design, 2026-11-03).
describe("a flow definition", () => {
  it("parses the trigger node, the agent nodes and the edges, with runs optional", () => {
    const parsed = flowDefinitionSchema.parse(flow([{ id: "e1", from: "trigger", to: "plan", kind: "required" }, { id: "e2", from: "plan", to: "build", kind: "optional" }]));

    assert.deepEqual(parsed.nodes.map((node) => node.id), ["trigger", "plan", "build"]);
    assert.deepEqual(agentNodesOf(parsed).map((node) => [node.agent, node.kind, node.runs]), [["planner", "planning", undefined], ["builder", "implementation", 3]]);
    assert.deepEqual(parsed.edges.map((edge) => edge.kind), ["required", "optional"]);
  });

  it("needs exactly one trigger node, with the fixed id, and unique node ids", () => {
    assert.deepEqual(flowDefinitionProblems(flow([], [plan, build])), ['A flow has exactly one trigger node (id "trigger").']);
    assert.deepEqual(flowDefinitionProblems(flow([], [trigger, plan, { ...build, id: "plan" }])), ['Node id "plan" is used twice.']);
    assert.equal(flowDefinitionSchema.safeParse(flow([], [{ ...trigger, id: "start" } as unknown as FlowDefinition["nodes"][number], plan])).success, false);
    assert.deepEqual(flowDefinitionProblems(flow([], [trigger, { ...plan, id: "trigger" }])), ['Node id "trigger" is used twice.', 'Node id "trigger" belongs to the trigger node.']);
  });

  it("refuses an edge to a node that isn't there, to itself, or into the trigger", () => {
    assert.deepEqual(flowDefinitionProblems(flow([{ id: "e1", from: "plan", to: "nowhere", kind: "required" }])), ['Edge "e1" goes from "plan" to "nowhere", but there is no such node.']);
    assert.deepEqual(flowDefinitionProblems(flow([{ id: "e1", from: "plan", to: "plan", kind: "required" }])), ['Edge "e1" connects "plan" to itself.']);
    assert.deepEqual(flowDefinitionProblems(flow([{ id: "e1", from: "plan", to: "trigger", kind: "optional" }])), ['Edge "e1": nothing leads into the trigger.']);
    assert.deepEqual(flowDefinitionProblems(flow([{ id: "e1", from: "trigger", to: "plan", kind: "required" }, { id: "e1", from: "plan", to: "build", kind: "required" }])), ['Edge id "e1" is used twice.']);
  });

  it("refuses a cycle through required edges but allows one through an optional edge", () => {
    const required = flow([{ id: "e1", from: "trigger", to: "plan", kind: "required" }, { id: "e2", from: "plan", to: "build", kind: "required" }, { id: "e3", from: "build", to: "plan", kind: "required" }]);
    const optional = flow([{ id: "e1", from: "trigger", to: "plan", kind: "required" }, { id: "e2", from: "plan", to: "build", kind: "required" }, { id: "e3", from: "build", to: "plan", kind: "optional" }]);

    assert.deepEqual(flowDefinitionProblems(required), ['Required edges form a cycle through "plan".']);
    assert.deepEqual(flowDefinitionProblems(optional), []);
    assert.equal(flowDefinitionSchema.safeParse(required).success, false);
    assert.equal(flowDefinitionSchema.safeParse(optional).success, true);
  });

  it("refuses an agent node without agent, kind or title, and runs below 1", () => {
    assert.equal(flowDefinitionSchema.safeParse(flow([], [trigger, { ...plan, agent: "" }])).success, false);
    assert.equal(flowDefinitionSchema.safeParse(flow([], [trigger, { ...plan, kind: " " }])).success, false);
    assert.equal(flowDefinitionSchema.safeParse(flow([], [trigger, { ...plan, title: "" }])).success, false);
    assert.equal(flowDefinitionSchema.safeParse(flow([], [trigger, { ...build, runs: 0 }])).success, false);
  });
});
