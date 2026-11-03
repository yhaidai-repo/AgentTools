import type { FlowDefinition, FlowEdge, FlowNode, TriggerNode } from "@/models/FlowDefinition";
import { TRIGGER_NODE_ID } from "@/models/FlowDefinition";

// Phase 0 keeps the flows in the browser: one localStorage key holding every flow (name, nodes with positions, edges).
const KEY = "powerloom-flow.flows";

export function listFlows(): FlowDefinition[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(KEY);
    const flows = raw ? (JSON.parse(raw) as FlowDefinition[]) : [];

    return flows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function getFlow(id: string): FlowDefinition | null {
  return listFlows().find((flow) => flow.id === id) ?? null;
}

export function saveFlow(flow: FlowDefinition): FlowDefinition {
  const saved = { ...flow, nodes: flow.nodes.map(atRest), updatedAt: new Date().toISOString() };
  const others = listFlows().filter((other) => other.id !== flow.id);

  write([saved, ...others]);

  return saved;
}

export function deleteFlow(id: string): void {
  write(listFlows().filter((flow) => flow.id !== id));
}

export function createFlow(name: string): FlowDefinition {
  const now = new Date().toISOString();
  const flow: FlowDefinition = { id: newId("flow"), name, nodes: [triggerNode()], edges: [], createdAt: now, updatedAt: now };

  write([flow, ...listFlows()]);

  return flow;
}

export function triggerNode(): TriggerNode {
  return { id: TRIGGER_NODE_ID, type: "trigger", position: { x: 40, y: 160 }, deletable: false, data: { status: "idle" } };
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** A node as it is saved: no execution state, no selection. */
function atRest(node: FlowNode): FlowNode {
  const { selected: _selected, dragging: _dragging, measured: _measured, ...rest } = node;

  if (rest.type === "agent") {
    return { ...rest, data: { ...rest.data, status: "idle", runsDone: 0 } };
  }

  return { ...rest, data: { status: "idle" } };
}

function write(flows: FlowDefinition[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(flows));
}

export function edgesAtRest(edges: FlowEdge[]): FlowEdge[] {
  return edges.map(({ selected: _selected, ...edge }) => edge);
}
