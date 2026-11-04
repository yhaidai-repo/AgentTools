"use client";

import { Background, Controls, ReactFlow, type EdgeTypes, type NodeTypes } from "@xyflow/react";
import { useMemo } from "react";
import type { FlowAgent } from "@/models/FlowAgent";
import { fromSavedDefinition, withSteps, type NodeStep, type SavedDefinition } from "@/models/FlowDefinition";
import { FlowEdgeView } from "./FlowEdgeView";
import { StepNode } from "./StepNode";
import { TriggerNode } from "./TriggerNode";

const nodeTypes: NodeTypes = { agent: StepNode, trigger: TriggerNode };
const edgeTypes: EdgeTypes = { flow: FlowEdgeView };

// The execution's flow, as it was when the execution started, read-only: each agent node carries its step.
export function ExecutionCanvas({ definition, steps, status, agents }: { definition: SavedDefinition; steps: NodeStep[]; status: string; agents: FlowAgent[] }) {
  const { nodes, edges } = useMemo(() => {
    const known = new Map(agents.map((agent) => [agent.id, { label: agent.label, handles: agent.handles }]));

    return withSteps(fromSavedDefinition(definition, known), steps, status);
  }, [definition, steps, status, agents]);

  return (
    <div className="canvas execution-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
