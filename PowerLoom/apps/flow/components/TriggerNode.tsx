"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TriggerNode as TriggerNodeType } from "@/models/FlowDefinition";
import { StatusBadge } from "./StatusBadge";

// The fixed start of every flow: fires when the execution starts (real triggers are deferred, design 2026-11-03). On
// the execution page it carries the execution's status.
export function TriggerNode({ data }: NodeProps<TriggerNodeType>) {
  return (
    <div className={`node trigger${data.executionStatus ? ` tone-${data.executionStatus}` : ""}`}>
      <div className="node-head">
        <span className="label">▶ Trigger</span>
        {data.executionStatus && <StatusBadge tone={data.executionStatus} />}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
