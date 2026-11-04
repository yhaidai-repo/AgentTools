"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from "@xyflow/react";
import type { FlowEdge } from "@/models/FlowDefinition";

// An edge with its kind on it: required (solid; the target waits for the source) or optional (dashed; the source's agent
// may create the target). The pill on the edge toggles the kind in the editor; on the execution page it is a label.
export function FlowEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, selected }: EdgeProps<FlowEdge>) {
  const { updateEdgeData } = useReactFlow();
  const kind = data?.kind ?? "required";
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const style = { position: "absolute" as const, transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` };

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={kind} style={selected ? { stroke: "var(--accent)" } : undefined} />
      <EdgeLabelRenderer>
        {data?.locked
          ? <span className={`edge-kind locked nodrag nopan ${kind}`} style={style}>{kind}</span>
          : (
            <button
              type="button"
              className={`edge-kind nodrag nopan ${kind}`}
              style={style}
              title="Click to toggle required / optional"
              onClick={() => updateEdgeData(id, { kind: kind === "required" ? "optional" : "required" })}
            >
              {kind}
            </button>
          )}
      </EdgeLabelRenderer>
    </>
  );
}
