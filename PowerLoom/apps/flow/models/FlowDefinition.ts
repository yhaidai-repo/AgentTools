import type { Edge, Node } from "@xyflow/react";
import { TRIGGER_NODE_ID, type FlowDefinition as SavedDefinition, type FlowEdge as SavedEdge, type FlowEdgeKind, type FlowNode as SavedNode } from "@powerloom/core/src/models/FlowDefinition";
import type { FlowExecutionStep } from "@powerloom/core/src/models/FlowExecutionStep";

// The canvas types of the Flow app, over the one definition contract (@powerloom/core's FlowDefinition, what
// PowerLoom's `flow.definition` holds). `toSavedDefinition` and `fromSavedDefinition` map the canvas to the contract
// (flow.save) and back; the execution page puts each node's step on it (read-only canvas).
export type { FlowEdgeKind, SavedDefinition, SavedEdge, SavedNode };
export { TRIGGER_NODE_ID };

export type EdgeKind = FlowEdgeKind;

/** One agent node's step of an execution, with the web links the server built. */
export type NodeStep = FlowExecutionStep & { taskUrl: string | null; runUrl: string | null; agentUrl: string };

/** What an agent node carries; `step` is set on the execution page only. */
export type AgentNodeData = {
  agentId: string;
  agentLabel: string;
  handles: string[];
  kind: string;
  titleTemplate: string;
  /** How many runs the node is expected to take (a hint for the agent and the progress; the sketch: Agent 3 three times). */
  runs: number;
  step?: NodeStep;
};

export type TriggerNodeData = {
  /** The execution's status on the execution page; absent in the editor. */
  executionStatus?: string;
};

export type FlowEdgeData = {
  kind: EdgeKind;
  /** Set on the execution page: the kind pill is a label, not a toggle. */
  locked?: boolean;
};

export type AgentNode = Node<AgentNodeData, "agent">;
export type TriggerNode = Node<TriggerNodeData, "trigger">;
export type FlowNode = AgentNode | TriggerNode;
export type FlowEdge = Edge<FlowEdgeData, "flow">;

export const DEFAULT_TITLE = "{kind} for {flow}";

export function triggerNode(position = { x: 40, y: 160 }): TriggerNode {
  return { id: TRIGGER_NODE_ID, type: "trigger", position, deletable: false, data: {} };
}

/** The canvas as the contract PowerLoom saves (flow.save): no labels, handles or execution state. */
export function toSavedDefinition(nodes: FlowNode[], edges: FlowEdge[]): SavedDefinition {
  return {
    nodes: nodes.map((node): SavedNode => (node.type === "agent"
      ? { id: node.id, type: "agent", agent: node.data.agentId, kind: node.data.kind, title: node.data.titleTemplate.trim() || DEFAULT_TITLE, runs: Math.max(1, node.data.runs), position: node.position }
      : { id: TRIGGER_NODE_ID, type: "trigger", position: node.position })),
    edges: edges.map((edge): SavedEdge => ({ id: edge.id, from: edge.source, to: edge.target, kind: edge.data?.kind ?? "required" })),
  };
}

/** The contract back on the canvas; `agents` supplies the labels and handles the palette knows. */
export function fromSavedDefinition(definition: SavedDefinition, agents: ReadonlyMap<string, { label: string; handles: string[] }>): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes = definition.nodes.map((node): FlowNode => (node.type === "agent"
    ? { id: node.id, type: "agent", position: node.position, data: { agentId: node.agent, agentLabel: agents.get(node.agent)?.label ?? node.agent, handles: handlesOf(agents.get(node.agent)?.handles, node.kind), kind: node.kind, titleTemplate: node.title, runs: node.runs ?? 1 } }
    : triggerNode(node.position)));
  const edges = definition.edges.map((edge): FlowEdge => ({ id: edge.id, source: edge.from, target: edge.to, type: "flow", data: { kind: edge.kind } }));

  return { nodes, edges };
}

// A saved kind the agent no longer handles stays selectable, so the node shows what was saved (the API refuses it on Save).
function handlesOf(handles: string[] | undefined, kind: string): string[] {
  const known = handles ?? [];

  return known.includes(kind) ? known : [...known, kind];
}

/** The canvas with each agent node coloured by its step and every edge locked: the execution page's read-only view. */
export function withSteps(canvas: { nodes: FlowNode[]; edges: FlowEdge[] }, steps: readonly NodeStep[], executionStatus: string): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const byNode = new Map(steps.map((step) => [step.nodeId, step]));

  return {
    nodes: canvas.nodes.map((node): FlowNode => (node.type === "agent"
      ? { ...node, draggable: false, connectable: false, deletable: false, data: { ...node.data, step: byNode.get(node.id) } }
      : { ...node, draggable: false, connectable: false, data: { executionStatus } })),
    edges: canvas.edges.map((edge): FlowEdge => ({ ...edge, deletable: false, data: { kind: edge.data?.kind ?? "required", locked: true } })),
  };
}

export function newNodeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
