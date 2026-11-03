import type { Edge, Node } from "@xyflow/react";

export type EdgeKind = "required" | "optional";

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

export const TRIGGER_NODE_ID = "trigger";

/** A saved flow, as localStorage keeps it: name, nodes with positions, edges. */
export interface FlowDefinition {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
  updatedAt: string;
}
