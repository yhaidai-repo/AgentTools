"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from "@xyflow/react";
import type { FlowEdge } from "@/models/FlowDefinition";

// An edge with its kind on it: required (solid; the target waits for the source) or optional (dashed; the target
// starts too, but is never held back). The pill on the edge toggles the kind.
export function FlowEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, selected }: EdgeProps<FlowEdge>) {
  const { updateEdgeData } = useReactFlow();
  const kind = data?.kind ?? "required";
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={kind} style={selected ? { stroke: "var(--accent)" } : undefined} />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={`edge-kind nodrag nopan ${kind}`}
          style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          title="Click to toggle required / optional"
          onClick={() => updateEdgeData(id, { kind: kind === "required" ? "optional" : "required" })}
        >
          {kind}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
