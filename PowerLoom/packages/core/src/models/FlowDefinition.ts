import { z } from "zod";

// A flow's canvas (PowerLoom Flow, design 2026-11-03): the one definition of what `flow.definition` holds, mirrored by
// the backend's FlowDefinitionRules (which also checks, against agent_config, that each node's kind is one its agent
// handles). One node is the trigger, with the fixed id "trigger"; every other node is an agent with the task kind it
// handles and the title its task gets. A required edge makes the target wait for the source; an optional edge says the
// source's agent may create the target (today's canAssign). Positions are the canvas's.

export const TRIGGER_NODE_ID = "trigger";

export const FLOW_EDGE_KINDS = ["required", "optional"] as const;

export type FlowEdgeKind = typeof FLOW_EDGE_KINDS[number];

const positionSchema = z.object({ x: z.number(), y: z.number() });

const nodeId = z.string().trim().min(1).describe("The node's id, unique in the flow");

export const triggerNodeSchema = z.object({
  id: z.literal(TRIGGER_NODE_ID),
  type: z.literal("trigger"),
  title: z.string().trim().min(1).optional().describe("A label for the canvas"),
  position: positionSchema,
});

export const agentNodeSchema = z.object({
  id: nodeId,
  type: z.literal("agent"),
  agent: z.string().trim().min(1).describe("The agent that runs the node's task (agent_list)"),
  kind: z.string().trim().min(1).describe("The task kind, one the agent handles"),
  title: z.string().trim().min(1).describe("The task's title; {kind} and {flow} are filled in"),
  runs: z.number().int().min(1).optional().describe("How many runs the node is expected to take (1 when left out)"),
  position: positionSchema,
});

export const flowNodeSchema = z.discriminatedUnion("type", [triggerNodeSchema, agentNodeSchema]);

export const flowEdgeSchema = z.object({
  id: z.string().trim().min(1).describe("The edge's id, unique in the flow"),
  from: nodeId,
  to: nodeId,
  kind: z.enum(FLOW_EDGE_KINDS).describe("required: the target waits for the source; optional: the source's agent may create the target"),
});

export type FlowTriggerNode = z.infer<typeof triggerNodeSchema>;
export type FlowAgentNode = z.infer<typeof agentNodeSchema>;
export type FlowNode = z.infer<typeof flowNodeSchema>;
export type FlowEdge = z.infer<typeof flowEdgeSchema>;

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// The structural rules, as the backend checks them (FlowDefinitionRules.Check); one message per problem.
export function flowDefinitionProblems(definition: FlowDefinition): string[] {
  const problems: string[] = [];
  const nodeIds = new Set<string>();

  for (const node of definition.nodes) {
    if (nodeIds.has(node.id)) problems.push(`Node id "${node.id}" is used twice.`);
    nodeIds.add(node.id);
    if (node.type === "agent" && node.id === TRIGGER_NODE_ID) problems.push(`Node id "${TRIGGER_NODE_ID}" belongs to the trigger node.`);
  }

  if (definition.nodes.filter((node) => node.type === "trigger").length !== 1) problems.push(`A flow has exactly one trigger node (id "${TRIGGER_NODE_ID}").`);

  const edgeIds = new Set<string>();

  for (const edge of definition.edges) {
    if (edgeIds.has(edge.id)) problems.push(`Edge id "${edge.id}" is used twice.`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) problems.push(`Edge "${edge.id}" goes from "${edge.from}" to "${edge.to}", but there is no such node.`);
    else if (edge.from === edge.to) problems.push(`Edge "${edge.id}" connects "${edge.from}" to itself.`);
    else if (edge.to === TRIGGER_NODE_ID) problems.push(`Edge "${edge.id}": nothing leads into the trigger.`);
  }

  const cycle = requiredCycle(definition);

  if (cycle) problems.push(`Required edges form a cycle through "${cycle}".`);

  return problems;
}

export const flowDefinitionSchema: z.ZodType<FlowDefinition> = z.object({
  nodes: z.array(flowNodeSchema).min(1).describe("The trigger node and the agent nodes"),
  edges: z.array(flowEdgeSchema).describe("What follows what"),
}).superRefine((definition, context) => {
  for (const message of flowDefinitionProblems(definition)) {
    context.addIssue({ code: "custom", message });
  }
});

// A required cycle would wait for itself forever; the node the walk came back to, or null.
function requiredCycle(definition: FlowDefinition): string | null {
  const next = new Map<string, string[]>();

  for (const edge of definition.edges) {
    // A self-edge is reported on its own.
    if (edge.kind !== "required" || edge.from === edge.to) continue;
    next.set(edge.from, [...(next.get(edge.from) ?? []), edge.to]);
  }

  const finished = new Set<string>();
  const path = new Set<string>();

  const walk = (node: string): string | null => {
    if (finished.has(node)) return null;
    if (path.has(node)) return node;
    path.add(node);

    for (const target of next.get(node) ?? []) {
      const found = walk(target);

      if (found) return found;
    }

    path.delete(node);
    finished.add(node);

    return null;
  };

  for (const node of definition.nodes) {
    const found = walk(node.id);

    if (found) return found;
  }

  return null;
}

/** The agent nodes of a definition, in canvas order. */
export function agentNodesOf(definition: FlowDefinition): FlowAgentNode[] {
  return definition.nodes.filter((node): node is FlowAgentNode => node.type === "agent");
}
