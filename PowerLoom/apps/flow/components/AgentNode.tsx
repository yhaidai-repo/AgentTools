"use client";

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import type { AgentNode as AgentNodeType, AgentNodeData } from "@/models/FlowDefinition";
import { StatusBadge } from "./StatusBadge";

// An agent on the canvas: its id, the task kind (one the agent handles), the title template, how many runs the mock
// plays, and the execution state (badge + run count) while a run is playing.
export function AgentNode({ id, data }: NodeProps<AgentNodeType>) {
  const { updateNodeData } = useReactFlow();
  const patch = (changes: Partial<AgentNodeData>) => updateNodeData(id, changes);
  const busy = data.status === "running" || data.status === "waiting";

  return (
    <div className={`node agent ${data.status}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-head">
        <span className="id" title={data.agentLabel}>{data.agentId}</span>
        {data.status !== "idle" && <StatusBadge status={data.status} />}
      </div>
      <div className="node-body nodrag">
        <div className="row">
          <label>
            kind
            <select value={data.kind} disabled={busy} onChange={(event) => patch({ kind: event.target.value })}>
              {data.handles.length === 0 && <option value="">(handles nothing)</option>}
              {data.handles.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </label>
          <label>
            runs
            <input className="runs" type="number" min={1} max={20} value={data.runs} disabled={busy} onChange={(event) => patch({ runs: clampRuns(event.target.valueAsNumber) })} />
          </label>
        </div>
        <label>
          title template
          <input value={data.titleTemplate} disabled={busy} placeholder="{kind} for {flow}" onChange={(event) => patch({ titleTemplate: event.target.value })} />
        </label>
      </div>
      <div className="node-foot">
        <span>{data.agentLabel}</span>
        <span className="runs">{data.status === "idle" ? `${data.runs} run${data.runs === 1 ? "" : "s"}` : `${data.runsDone} / ${data.runs} runs`}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function clampRuns(value: number): number {
  return Number.isFinite(value) ? Math.min(20, Math.max(1, Math.round(value))) : 1;
}
