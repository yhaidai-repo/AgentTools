"use client";

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import type { AgentNode as AgentNodeType, AgentNodeData } from "@/models/FlowDefinition";

// An agent on the canvas (the editor): its id, the task kind (one the agent handles), the title template and how many
// runs the node is expected to take. The execution page shows the same node as a StepNode.
export function AgentNode({ id, data }: NodeProps<AgentNodeType>) {
  const { updateNodeData } = useReactFlow();
  const patch = (changes: Partial<AgentNodeData>) => updateNodeData(id, changes);

  return (
    <div className="node agent">
      <Handle type="target" position={Position.Left} />
      <div className="node-head">
        <span className="id" title={data.agentLabel}>{data.agentId}</span>
      </div>
      <div className="node-body nodrag">
        <div className="row">
          <label>
            kind
            <select value={data.kind} onChange={(event) => patch({ kind: event.target.value })}>
              {data.handles.length === 0 && <option value="">(handles nothing)</option>}
              {data.handles.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </label>
          <label>
            runs
            <input className="runs" type="number" min={1} max={20} value={data.runs} onChange={(event) => patch({ runs: clampRuns(event.target.valueAsNumber) })} />
          </label>
        </div>
        <label>
          title template
          <input value={data.titleTemplate} placeholder="{kind} for {flow}" onChange={(event) => patch({ titleTemplate: event.target.value })} />
        </label>
      </div>
      <div className="node-foot">
        <span>{data.agentLabel}</span>
        <span className="runs">{data.runs} run{data.runs === 1 ? "" : "s"}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function clampRuns(value: number): number {
  return Number.isFinite(value) ? Math.min(20, Math.max(1, Math.round(value))) : 1;
}
