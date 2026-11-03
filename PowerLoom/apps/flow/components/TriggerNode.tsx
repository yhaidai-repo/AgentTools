"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TriggerNode as TriggerNodeType } from "@/models/FlowDefinition";
import { StatusBadge } from "./StatusBadge";

// The fixed start of every flow: fires when the execution starts (real triggers are deferred, design 2026-11-03).
export function TriggerNode({ data }: NodeProps<TriggerNodeType>) {
  return (
    <div className={`node trigger ${data.status}`}>
      <div className="node-head">
        <span className="label">▶ Trigger</span>
        {data.status !== "idle" && <StatusBadge status={data.status} />}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
