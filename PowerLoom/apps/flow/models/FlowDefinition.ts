import type { Edge, Node } from "@xyflow/react";
import { TRIGGER_NODE_ID, type FlowDefinition as SavedDefinition, type FlowEdge as SavedEdge, type FlowEdgeKind, type FlowNode as SavedNode } from "@powerloom/core/src/models/FlowDefinition";

// The canvas types of the Flow app, over the one definition contract (@powerloom/core's FlowDefinition, what
// PowerLoom's `flow.definition` holds). Phase 0 keeps the canvas shape in the browser; `toSavedDefinition` and
// `fromSavedDefinition` map it to the contract, so phase 3 saves through flow.save without changing the editor.
export type { FlowEdgeKind, SavedDefinition, SavedEdge, SavedNode };
export { TRIGGER_NODE_ID };

export type EdgeKind = FlowEdgeKind;

export type NodeRunStatus = "idle" | "waiting" | "running" | "done";

/** What an agent node carries; the mock execution writes `status` and `runsDone` into it. */
export type AgentNodeData = {
  agentId: string;
  agentLabel: string;
  handles: string[];
  kind: string;
  titleTemplate: string;
  /** How many runs the mock plays for this node (the sketch: Agent 3 runs three times). */
  runs: number;
  status: NodeRunStatus;
  runsDone: number;
};

export type TriggerNodeData = {
  status: NodeRunStatus;
};

export type FlowEdgeData = {
  kind: EdgeKind;
};

export type AgentNode = Node<AgentNodeData, "agent">;
export type TriggerNode = Node<TriggerNodeData, "trigger">;
export type FlowNode = AgentNode | TriggerNode;
export type FlowEdge = Edge<FlowEdgeData, "flow">;

/** A saved flow, as localStorage keeps it: name, nodes with positions, edges. */
export interface FlowDefinition {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
  updatedAt: string;
}

/** The canvas as the contract PowerLoom saves (flow.save): no labels, handles or execution state. */
export function toSavedDefinition(nodes: FlowNode[], edges: FlowEdge[]): SavedDefinition {
  return {
    nodes: nodes.map((node): SavedNode => (node.type === "agent"
      ? { id: node.id, type: "agent", agent: node.data.agentId, kind: node.data.kind, title: node.data.titleTemplate || "{kind} for {flow}", runs: Math.max(1, node.data.runs), position: node.position }
      : { id: TRIGGER_NODE_ID, type: "trigger", position: node.position })),
    edges: edges.map((edge): SavedEdge => ({ id: edge.id, from: edge.source, to: edge.target, kind: edge.data?.kind ?? "required" })),
  };
}

/** The contract back on the canvas; `agents` supplies the labels and handles the palette knows. */
export function fromSavedDefinition(definition: SavedDefinition, agents: ReadonlyMap<string, { label: string; handles: string[] }>): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes = definition.nodes.map((node): FlowNode => (node.type === "agent"
    ? { id: node.id, type: "agent", position: node.position, data: { agentId: node.agent, agentLabel: agents.get(node.agent)?.label ?? node.agent, handles: agents.get(node.agent)?.handles ?? [node.kind], kind: node.kind, titleTemplate: node.title, runs: node.runs ?? 1, status: "idle", runsDone: 0 } }
    : { id: TRIGGER_NODE_ID, type: "trigger", position: node.position, deletable: false, data: { status: "idle" } }));
  const edges = definition.edges.map((edge): FlowEdge => ({ id: edge.id, source: edge.from, target: edge.to, type: "flow", data: { kind: edge.kind } }));

  return { nodes, edges };
}
