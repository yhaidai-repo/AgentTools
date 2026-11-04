import type { Flow, FlowExecution, FlowWorkPort } from "@powerloom/core";
import type { PowerLoomClient } from "./createPowerLoomClient";
import type { components } from "./schema";
import { powerloomFailure } from "./powerloomFailure";

// The Flow app's writes over PowerLoom's API (PowerLoom Flow phase 1; the execution's steps since phase 2).
export function flowWorkPort(powerloom: PowerLoomClient): FlowWorkPort {
  return {
    async saveFlow(input) {
      const { data, error, response } = await powerloom.PUT("/api/flows", { body: { id: input.id, vault: input.vault, name: input.name, definition: definitionBody(input.definition) } });

      return data ? { ok: true, value: flowOf(data) } : powerloomFailure(error, response);
    },
    async deleteFlow(id) {
      const { data, error, response } = await powerloom.DELETE("/api/flows/{id}", { params: { path: { id } } });

      return data ? { ok: true, value: data.name } : powerloomFailure(error, response);
    },
    async runFlow(id, vault, target) {
      const body = { vault, target: target.kind === "pbi" ? { kind: "pbi", pbiId: target.pbiId, itemId: null } : { kind: "task", pbiId: null, itemId: target.itemId } };
      const { data, error, response } = await powerloom.POST("/api/flows/{id}/run", { params: { path: { id } }, body });

      return data ? { ok: true, value: executionOf(data) } : powerloomFailure(error, response);
    },
    async cancelFlowExecution(id) {
      const { data, error, response } = await powerloom.POST("/api/flow-executions/{id}/cancel", { params: { path: { id } } });

      return data ? { ok: true, value: executionOf(data) } : powerloomFailure(error, response);
    },
  };
}

type DefinitionBody = components["schemas"]["FlowDefinitionInput"];

// The API's flat node record: the trigger node sends no agent fields.
function definitionBody(definition: Flow["definition"]): DefinitionBody {
  return {
    nodes: definition.nodes.map((node) => (node.type === "trigger"
      ? { id: node.id, type: node.type, agent: null, kind: null, title: node.title ?? null, runs: null, position: node.position }
      : { id: node.id, type: node.type, agent: node.agent, kind: node.kind, title: node.title, runs: node.runs ?? null, position: node.position })),
    edges: definition.edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, kind: edge.kind })),
  };
}

// Back from the flat record: PowerLoom validated the definition, so the shape is the schema's.
function definitionOf(definition: DefinitionBody): Flow["definition"] {
  return {
    nodes: definition.nodes.map((node) => (node.type === "trigger"
      ? { id: "trigger" as const, type: "trigger" as const, position: node.position, ...(node.title ? { title: node.title } : {}) }
      : { id: node.id, type: "agent" as const, agent: node.agent ?? "", kind: node.kind ?? "", title: node.title ?? "", position: node.position, ...(node.runs != null ? { runs: node.runs } : {}) })),
    edges: definition.edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, kind: edge.kind === "optional" ? "optional" : "required" })),
  };
}

function flowOf(saved: components["schemas"]["SavedFlow"]): Flow {
  return { id: saved.id, vault: saved.vault, name: saved.name, version: saved.version, definition: definitionOf(saved.definition), createdAt: new Date(saved.createdAt), updatedAt: new Date(saved.updatedAt) };
}

function executionOf(view: components["schemas"]["FlowExecutionView"]): FlowExecution {
  return {
    id: view.id,
    flowId: view.flowId,
    flowVersion: view.flowVersion,
    vault: view.vault,
    targetKind: view.targetKind === "task" ? "task" : "pbi",
    pbiId: view.pbiId ?? null,
    itemId: view.itemId ?? null,
    status: statusOf(view.status),
    error: view.error ?? null,
    startedAt: new Date(view.startedAt),
    finishedAt: view.finishedAt ? new Date(view.finishedAt) : null,
    definition: definitionOf(view.definition),
    steps: view.steps.map((step) => ({ nodeId: step.nodeId, itemId: step.itemId ?? null, status: step.status as FlowExecution["steps"][number]["status"], runs: step.runs, agent: step.agent, kind: step.kind })),
  };
}

function statusOf(status: string): FlowExecution["status"] {
  return status === "done" || status === "failed" || status === "cancelled" ? status : "running";
}
