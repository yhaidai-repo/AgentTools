import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CommandContext } from "../models/CommandContext";
import { TRIGGER_NODE_ID } from "../models/FlowDefinition";
import { cancelFlowExecutionCommand } from "./cancelFlowExecutionCommand";
import { deleteFlowCommand } from "./deleteFlowCommand";
import { runFlowCommand } from "./runFlowCommand";
import { saveFlowCommand } from "./saveFlowCommand";

const definition = {
  nodes: [
    { id: TRIGGER_NODE_ID, type: "trigger" as const, position: { x: 0, y: 0 } },
    { id: "plan", type: "agent" as const, agent: "planner", kind: "planning", title: "Plan {flow}", position: { x: 300, y: 0 } },
  ],
  edges: [{ id: "e1", from: TRIGGER_NODE_ID, to: "plan", kind: "required" as const }],
};

// Flows are PowerLoom's own tables (user decision 2026-10-26): the commands hand every write to the API and pass its
// refusal on; the structural checks run before the call, so a broken canvas never reaches PowerLoom.
describe("the flow commands", () => {
  it("save a flow through PowerLoom after the schema's own checks", async () => {
    const sent: unknown[] = [];
    const flow = { id: "FL-001", vault: "work", name: "Plan", version: 1, definition, createdAt: new Date(0), updatedAt: new Date(0) };
    const context = { powerloom: { saveFlow: async (input: unknown) => (sent.push(input), { ok: true, value: flow }) } } as unknown as CommandContext;
    const input = saveFlowCommand.input.parse({ id: null, vault: "work", name: "Plan", definition });

    const saved = await saveFlowCommand.run(context, input);
    const broken = saveFlowCommand.input.safeParse({ vault: "work", name: "Plan", definition: { ...definition, edges: [{ id: "e1", from: "plan", to: "gone", kind: "required" }] } });

    assert.deepEqual(saved, { ok: true, value: flow });
    assert.deepEqual(sent, [{ id: null, vault: "work", name: "Plan", definition }]);
    assert.equal(broken.success, false);
    assert.match(broken.success ? "" : broken.error.issues.map((issue) => issue.message).join("\n"), /no such node/);
  });

  it("delete, run and cancel through PowerLoom and pass its refusal on", async () => {
    const calls: unknown[] = [];
    const powerloom = {
      deleteFlow: async (id: string) => (calls.push(["delete", id]), { ok: true, value: "Plan" }),
      runFlow: async (id: string, vault: string, target: unknown) => (calls.push(["run", id, vault, target]), { ok: false, error: "PBI 7 isn't in vault work." }),
      cancelFlowExecution: async (id: string) => (calls.push(["cancel", id]), { ok: true, value: { id, status: "cancelled" } }),
    };
    const context = { powerloom } as unknown as CommandContext;

    const deleted = await deleteFlowCommand.run(context, { id: "FL-001" });
    const refused = await runFlowCommand.run(context, runFlowCommand.input.parse({ id: "FL-001", vault: "work", target: { kind: "pbi", pbiId: 7 } }));
    const cancelled = await cancelFlowExecutionCommand.run(context, { id: "FX-001" });

    assert.deepEqual(deleted, { ok: true, value: { id: "FL-001", name: "Plan" } });
    assert.deepEqual(refused, { ok: false, error: "PBI 7 isn't in vault work." });
    assert.deepEqual(cancelled, { ok: true, value: { id: "FX-001", status: "cancelled" } });
    assert.deepEqual(calls, [["delete", "FL-001"], ["run", "FL-001", "work", { kind: "pbi", pbiId: 7 }], ["cancel", "FX-001"]]);
    assert.equal(runFlowCommand.input.safeParse({ id: "FL-001", vault: "work", target: { kind: "task" } }).success, false);
  });
});
