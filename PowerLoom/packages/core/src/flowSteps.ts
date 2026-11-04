import type { FlowExecutionStatus } from "@powerloom/db";
import { agentNodesOf, type FlowAgentNode, type FlowDefinition } from "./models/FlowDefinition";
import type { FlowExecutionStep, FlowStepStatus } from "./models/FlowExecutionStep";

// What a flow task carries in `local_item.data` (the backend's FlowTaskData): the execution and node it belongs to. A
// task an agent creates inside an execution inherits both from its parent (packages/agents commitCreatedTasks); only the
// engine's own task of a node carries the key "<execution>:<node>".
export interface FlowMarkers {
  flowExecutionId: string;
  flowNodeId: string;
}

export function flowMarkersOf(data: unknown): FlowMarkers | null {
  const { flowExecutionId, flowNodeId } = (data as Partial<Record<keyof FlowMarkers, unknown>> | null) ?? {};

  return typeof flowExecutionId === "string" && typeof flowNodeId === "string" ? { flowExecutionId, flowNodeId } : null;
}

/** A task of an execution, as the steps need it. */
export interface FlowTaskRow {
  id: string;
  kind: string;
  status: Exclude<FlowStepStatus, "pending" | "skipped">;
  assignee: string;
  parentId: string | null;
  data: unknown;
  runs: number;
  lastRunId: number | null;
}

// The steps of an execution from its tasks, one per agent node in the definition's order (the backend's FlowSteps):
// the engine's task of the node (its key), else, for a node fed only by optional edges, the task an upstream agent
// created for it: the first of the node's kind whose parent is a task of one of those predecessors.
export function flowStepsOf(executionId: string, status: FlowExecutionStatus, definition: FlowDefinition, tasks: readonly FlowTaskRow[]): FlowExecutionStep[] {
  const nodes = agentNodesOf(definition);
  const own = new Map<string, FlowTaskRow>();

  for (const node of nodes) {
    const task = tasks.find((row) => keyOf(row.data) === `${executionId}:${node.id}`);

    if (task) own.set(node.id, task);
  }

  const optionalOnly = new Set(nodes.filter((node) => isOptionalOnly(definition, node.id)).map((node) => node.id));
  const byNode = new Map(own);

  for (const node of nodes) {
    if (byNode.has(node.id) || !optionalOnly.has(node.id)) continue;
    const parents = new Set(definition.edges.filter((edge) => edge.to === node.id && edge.kind === "optional").map((edge) => own.get(edge.from)?.id).filter((id): id is string => id !== undefined));
    const attributed = tasks.find((row) => row.kind === node.kind && row.parentId !== null && parents.has(row.parentId) && !own.has(row.id));

    if (attributed) byNode.set(node.id, attributed);
  }

  return nodes.map((node) => stepOf(node, byNode.get(node.id) ?? null, status));
}

function stepOf(node: FlowAgentNode, task: FlowTaskRow | null, status: FlowExecutionStatus): FlowExecutionStep {
  if (!task) {
    return { nodeId: node.id, itemId: null, status: status === "running" ? "pending" : "skipped", runs: 0, lastRunId: null, agent: node.agent, kind: node.kind };
  }

  return { nodeId: node.id, itemId: task.id, status: task.status, runs: task.runs, lastRunId: task.lastRunId, agent: agentOf(task.assignee) ?? node.agent, kind: task.kind };
}

// Fed by agent nodes through optional edges only, and not by the trigger: the engine never creates its task.
function isOptionalOnly(definition: FlowDefinition, nodeId: string): boolean {
  const incoming = definition.edges.filter((edge) => edge.to === nodeId);

  return incoming.length > 0 && incoming.every((edge) => edge.kind === "optional" && edge.from !== "trigger");
}

function keyOf(data: unknown): string | null {
  const key = (data as { key?: unknown } | null)?.key;

  return typeof key === "string" ? key : null;
}

// The pinned agent; a task for any agent of its kind ("agent:*") shows the node's.
function agentOf(assignee: string): string | null {
  const agent = assignee.startsWith("agent:") ? assignee.slice("agent:".length) : null;

  return agent === "*" ? null : agent;
}
