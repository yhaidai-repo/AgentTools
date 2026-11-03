"use client";

import type { DragEvent } from "react";
import type { FlowAgent } from "@/models/FlowAgent";

export const DRAG_TYPE = "application/powerloom-flow-agent";

// Today's agents (from agent_config.agent): drag one onto the canvas, or click it to add it at a free spot.
export function Palette({ agents, source, error, onAdd }: { agents: FlowAgent[]; source: string; error: string | null; onAdd: (agent: FlowAgent) => void }) {
  const onDragStart = (event: DragEvent<HTMLDivElement>, agent: FlowAgent) => {
    event.dataTransfer.setData(DRAG_TYPE, agent.id);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="palette card">
      <h2>Agents</h2>
      <span className="hint">Drag onto the canvas or click to add. From {source}.</span>
      {error && <div className="palette-error">Agents could not be read: {error}. Set FLOW_AGENTS_STUB=1 for a stubbed list.</div>}
      {agents.map((agent) => (
        <div key={agent.id} className={`palette-agent${agent.enabled ? "" : " off"}`} draggable onDragStart={(event) => onDragStart(event, agent)} onClick={() => onAdd(agent)} title={agent.description}>
          <span className="id">{agent.id}</span>
          <span className="label">{agent.label}{agent.enabled ? "" : " (paused)"}</span>
          <span className="kinds">handles {agent.handles.length ? agent.handles.map((kind) => <code key={kind}>{kind} </code>) : "nothing"}</span>
        </div>
      ))}
    </aside>
  );
}
