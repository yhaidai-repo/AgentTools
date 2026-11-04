"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { stepTone } from "@/lib/stepLooks";
import type { AgentNode as AgentNodeType } from "@/models/FlowDefinition";
import { StatusBadge } from "./StatusBadge";

// An agent node on the execution page: read-only, coloured by its step's status, with the task's run count and the
// links into the web app (the task's page, its latest run, the agent).
export function StepNode({ data }: NodeProps<AgentNodeType>) {
  const step = data.step;
  const tone = step ? stepTone(step.status) : "pending";

  return (
    <div className={`node agent step tone-${tone}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-head">
        <a className="id" href={step?.agentUrl} target="_blank" rel="noreferrer" title={`${data.agentLabel}: open the agent in the web app`}>{step?.agent ?? data.agentId}</a>
        <StatusBadge tone={tone} label={step?.status ?? "pending"} />
      </div>
      <div className="node-body step-body">
        <div className="step-line"><span className="faint">kind</span> <code>{step?.kind ?? data.kind}</code></div>
        <div className="step-line"><span className="faint">title</span> {data.titleTemplate}</div>
        <div className="step-line">
          <span className="faint">task</span>
          {step?.itemId && step.taskUrl ? <a href={step.taskUrl} target="_blank" rel="noreferrer">{step.itemId} ↗</a> : <span className="faint">none yet</span>}
        </div>
      </div>
      <div className="node-foot">
        <span>{step?.runUrl && step.lastRunId !== null ? <a href={step.runUrl} target="_blank" rel="noreferrer">RUN-{step.lastRunId} ↗</a> : <span>{data.agentLabel}</span>}</span>
        <span className="runs">{step?.runs ?? 0} / {data.runs} run{data.runs === 1 ? "" : "s"}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
