"use client";

import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type DragEvent } from "react";
import { deleteFlowAction, saveFlowAction } from "@/app/actions";
import type { AgentPalette } from "@/lib/agents";
import { formatTime } from "@/lib/format";
import { DEFAULT_TITLE, fromSavedDefinition, newNodeId, toSavedDefinition, triggerNode, type AgentNode as AgentNodeType, type FlowEdge, type FlowNode, type SavedDefinition } from "@/models/FlowDefinition";
import type { FlowAgent } from "@/models/FlowAgent";
import { AgentNode } from "./AgentNode";
import { FlowEdgeView } from "./FlowEdgeView";
import { DRAG_TYPE, Palette } from "./Palette";
import { RunDialog } from "./RunDialog";
import { TriggerNode } from "./TriggerNode";

const nodeTypes: NodeTypes = { agent: AgentNode, trigger: TriggerNode };
const edgeTypes: EdgeTypes = { flow: FlowEdgeView };

/** A saved flow as the editor opens it; null for a new one. */
export interface EditorFlow {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  definition: SavedDefinition;
  executions: number;
}

export function FlowEditor({ flow, palette }: { flow: EditorFlow | null; palette: AgentPalette }) {
  return (
    <ReactFlowProvider>
      <Editor flow={flow} palette={palette} />
    </ReactFlowProvider>
  );
}

// The canvas of one flow: the palette, the nodes and edges. Save sends the definition through flow.save (PowerLoom
// checks it and bumps the version); Run opens the target dialog; Delete removes the flow and its finished executions.
function Editor({ flow, palette }: { flow: EditorFlow | null; palette: AgentPalette }) {
  const router = useRouter();
  const agents = useMemo(() => new Map(palette.agents.map((agent) => [agent.id, { label: agent.label, handles: agent.handles }])), [palette.agents]);
  const opened = useMemo(() => (flow ? fromSavedDefinition(flow.definition, agents) : { nodes: [triggerNode()], edges: [] }), [flow, agents]);
  const [saved, setSaved] = useState<EditorFlow | null>(flow);
  const [name, setName] = useState(flow?.name ?? "");
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(opened.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(opened.edges);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  const definition = useMemo(() => toSavedDefinition(nodes, edges), [nodes, edges]);
  const dirty = saved === null || name.trim() !== saved.name || JSON.stringify(definition) !== JSON.stringify(saved.definition);

  const addAgent = useCallback((agent: FlowAgent, position?: { x: number; y: number }) => {
    const node: AgentNodeType = {
      id: newNodeId(agent.id),
      type: "agent",
      position: position ?? { x: 320 + (nodes.length % 3) * 60, y: 80 + nodes.length * 70 },
      data: { agentId: agent.id, agentLabel: agent.label, handles: agent.handles, kind: agent.handles[0] ?? "", titleTemplate: DEFAULT_TITLE, runs: 1 },
    };

    setNodes((current) => [...current, node]);
  }, [nodes.length, setNodes]);

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source === connection.target) return;

    setEdges((current) => addEdge<FlowEdge>({ ...connection, type: "flow", data: { kind: "required" }, markerEnd: { type: MarkerType.ArrowClosed } }, current));
  }, [setEdges]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();

    const agent = palette.agents.find((candidate) => candidate.id === event.dataTransfer.getData(DRAG_TYPE));

    if (agent) addAgent(agent, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }, [palette.agents, addAgent, screenToFlowPosition]);

  const save = async () => {
    const flowName = name.trim();

    if (!flowName) {
      setProblems(["Give the flow a name."]);

      return;
    }
    setBusy(true);

    const outcome = await saveFlowAction({ id: saved?.id ?? null, name: flowName, definition });

    setBusy(false);
    if (!outcome.ok) {
      setProblems(problemLines(outcome.error));

      return;
    }
    setProblems([]);
    setSaved({ id: outcome.value.id, name: outcome.value.name, version: outcome.value.version, updatedAt: outcome.value.updatedAt, definition, executions: saved?.executions ?? 0 });
    setName(outcome.value.name);
    if (saved === null) router.replace(`/flows/${encodeURIComponent(outcome.value.id)}`);
  };

  const remove = async () => {
    if (!saved || !window.confirm(`Delete flow "${saved.name}" and its finished executions?`)) return;
    setBusy(true);

    const outcome = await deleteFlowAction(saved.id);

    if (outcome.ok) {
      router.push("/");
    } else {
      setProblems([outcome.error]);
      setBusy(false);
    }
  };

  const agentCount = nodes.filter((node) => node.type === "agent").length;

  return (
    <div className="editor">
      <div className="editor-bar">
        <Link href="/" className="muted">← Flows</Link>
        <input className="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Flow name" aria-label="Flow name" />
        <span className={`state${dirty ? " dirty" : ""}`}>
          {saved ? <>v{saved.version} · saved {formatTime(saved.updatedAt)}{dirty ? " · unsaved changes" : ""}</> : "new flow, not saved yet"}
        </span>
        <span className="spacer" />
        <button type="button" onClick={save} disabled={busy || !dirty}>{busy ? "Working…" : "Save"}</button>
        <button type="button" className="secondary" onClick={() => setRunOpen(true)} disabled={busy} title={saved === null || dirty ? "Save first" : "Run the saved flow for a PBI or a task"}>Run</button>
        {saved && <Link href={`/executions?flow=${encodeURIComponent(saved.id)}`} className="muted">{saved.executions} execution{saved.executions === 1 ? "" : "s"}</Link>}
        {saved && <button type="button" className="danger" onClick={remove} disabled={busy}>Delete</button>}
      </div>
      {problems.length > 0 && (
        <ul className="problems">
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}
      <div className="editor-body">
        <Palette agents={palette.agents} source={palette.source} error={palette.error} onAdd={(agent) => addAgent(agent)} />
        <div className="canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={24} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>
      {runOpen && <RunDialog flowId={saved?.id ?? "FL-000"} flowName={saved?.name ?? name} onClose={() => setRunOpen(false)} />}
    </div>
  );
}

// A command's refusal comes as one text; zod's prettified errors put one problem per line.
function problemLines(error: string): string[] {
  const lines = error.split("\n").map((line) => line.replace(/^[✖→\s]+/, "").trim()).filter(Boolean);

  return lines.length > 0 ? lines : [error];
}
