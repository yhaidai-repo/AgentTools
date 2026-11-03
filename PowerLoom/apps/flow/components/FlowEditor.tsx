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
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { AgentPalette } from "@/lib/agents";
import { listExecutions, upsertExecution } from "@/lib/executionStore";
import { edgesAtRest, getFlow, newId, saveFlow } from "@/lib/flowStore";
import { fillTitle } from "@/lib/format";
import { startMockRun, type RunSnapshot } from "@/lib/mockRun";
import type { ExecutionRecord } from "@/models/ExecutionRecord";
import type { AgentNode as AgentNodeType, FlowDefinition, FlowEdge, FlowNode } from "@/models/FlowDefinition";
import type { FlowAgent } from "@/models/FlowAgent";
import { AgentNode } from "./AgentNode";
import { FlowEdgeView } from "./FlowEdgeView";
import { DRAG_TYPE, Palette } from "./Palette";
import { TriggerNode } from "./TriggerNode";

const nodeTypes: NodeTypes = { agent: AgentNode, trigger: TriggerNode };
const edgeTypes: EdgeTypes = { flow: FlowEdgeView };
const RUN_MS = 1000;

export function FlowEditor({ flowId, palette }: { flowId: string; palette: AgentPalette }) {
  return (
    <ReactFlowProvider>
      <Editor flowId={flowId} palette={palette} />
    </ReactFlowProvider>
  );
}

// The canvas of one flow: the palette, the nodes and edges (kept in localStorage on Save) and the mocked run.
function Editor({ flowId, palette }: { flowId: string; palette: AgentPalette }) {
  const [flow, setFlow] = useState<FlowDefinition | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [run, setRun] = useState<RunSnapshot | null>(null);
  const execution = useRef<ExecutionRecord | null>(null);
  const cancelRun = useRef<(() => void) | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    const loaded = getFlow(flowId);

    setFlow(loaded);
    if (loaded) {
      setName(loaded.name);
      setNodes(loaded.nodes);
      setEdges(loaded.edges);
      setSavedAt(loaded.updatedAt);
    }
  }, [flowId, setNodes, setEdges]);

  useEffect(() => () => cancelRun.current?.(), []);

  const running = run !== null && !run.finished;
  const dirty = useMemo(() => flow != null && (name !== flow.name || JSON.stringify(nodesAtRest(nodes)) !== JSON.stringify(nodesAtRest(flow.nodes)) || JSON.stringify(edgesAtRest(edges)) !== JSON.stringify(edgesAtRest(flow.edges))), [flow, name, nodes, edges]);

  const addAgent = useCallback((agent: FlowAgent, position?: { x: number; y: number }) => {
    const node: AgentNodeType = {
      id: newId(agent.id),
      type: "agent",
      position: position ?? { x: 320 + (nodes.length % 3) * 60, y: 80 + nodes.length * 70 },
      data: { agentId: agent.id, agentLabel: agent.label, handles: agent.handles, kind: agent.handles[0] ?? "", titleTemplate: "{kind} for {flow}", runs: 1, status: "idle", runsDone: 0 },
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

  const save = () => {
    if (!flow) return;

    const saved = saveFlow({ ...flow, name: name.trim() || flow.name, nodes, edges: edgesAtRest(edges) });

    setFlow(saved);
    setName(saved.name);
    setSavedAt(saved.updatedAt);
  };

  const applySnapshot = useCallback((snapshot: RunSnapshot) => {
    setNodes((current) => current.map((node) => {
      const state = snapshot.nodes[node.id];

      if (!state) return node;

      return node.type === "agent"
        ? { ...node, data: { ...node.data, status: state.status, runsDone: state.runsDone } }
        : { ...node, data: { ...node.data, status: state.status } };
    }));
    setRun(snapshot);

    const record = execution.current;

    if (record) {
      record.nodes = record.nodes.map((entry) => ({ ...entry, status: snapshot.nodes[entry.nodeId]?.status ?? entry.status, runsDone: snapshot.nodes[entry.nodeId]?.runsDone ?? entry.runsDone }));
      if (snapshot.finished) {
        record.status = "done";
        record.finishedAt = new Date().toISOString();
      }
      upsertExecution({ ...record });
    }
  }, [setNodes]);

  const startRun = () => {
    cancelRun.current?.();

    const flowName = name.trim() || "flow";

    execution.current = {
      id: newId("exec"),
      flowId,
      flowName,
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      nodes: nodes.filter((node): node is AgentNodeType => node.type === "agent").map((node) => ({
        nodeId: node.id,
        agentId: node.data.agentId,
        kind: node.data.kind,
        title: fillTitle(node.data.titleTemplate, { agent: node.data.agentId, kind: node.data.kind, flow: flowName }),
        runs: node.data.runs,
        runsDone: 0,
        status: "waiting",
      })),
    };
    cancelRun.current = startMockRun(nodes, edges, { runMs: RUN_MS, onSnapshot: applySnapshot });
  };

  const stopRun = () => {
    cancelRun.current?.();
    cancelRun.current = null;

    const record = execution.current;

    if (record && record.status === "running") {
      record.status = "cancelled";
      record.finishedAt = new Date().toISOString();
      upsertExecution({ ...record });
    }
    setRun((current) => (current ? { ...current, finished: true } : current));
  };

  const resetRun = () => {
    stopRun();
    execution.current = null;
    setRun(null);
    setNodes((current) => current.map((node) => (node.type === "agent" ? { ...node, data: { ...node.data, status: "idle", runsDone: 0 } } : { ...node, data: { ...node.data, status: "idle" } })));
  };

  if (flow === undefined) return <p className="muted">Loading…</p>;

  if (flow === null) {
    return (
      <div className="empty">
        <p>No flow <code>{flowId}</code> in this browser.</p>
        <Link href="/">Back to the flows</Link>
      </div>
    );
  }

  const percent = run ? Math.round((run.progress.done / Math.max(1, run.progress.total)) * 100) : 0;
  const executionCount = typeof window === "undefined" ? 0 : listExecutions().filter((record) => record.flowId === flowId).length;

  return (
    <div className="editor">
      <div className="editor-bar">
        <Link href="/" className="muted">← Flows</Link>
        <input className="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Flow name" aria-label="Flow name" />
        <span className={`state${dirty ? " dirty" : ""}`}>{dirty ? "unsaved changes" : savedAt ? `saved ${new Date(savedAt).toLocaleTimeString()}` : ""}</span>
        <span className="spacer" />
        <button type="button" onClick={save} disabled={!dirty}>Save</button>
        {running
          ? <button type="button" className="secondary" onClick={stopRun}>Stop</button>
          : <button type="button" className="secondary" onClick={startRun} disabled={nodes.length < 2}>Run (mock)</button>}
        {run && !running && <button type="button" className="secondary" onClick={resetRun}>Reset</button>}
        <Link href="/executions" className="muted">{executionCount} execution{executionCount === 1 ? "" : "s"} ↗</Link>
      </div>
      {run && (
        <div className="run-bar">
          <span className="text">{run.finished ? (execution.current?.status === "cancelled" ? "Cancelled" : "Done") : "Running"}: {run.progress.done} / {run.progress.total} runs</span>
          <div className={`progress${run.finished ? " done" : ""}`}><span style={{ width: `${percent}%` }} /></div>
          <span className="text">{percent}%</span>
        </div>
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
            nodesConnectable={!running}
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
    </div>
  );
}

/** Nodes without execution state, selection or measurements: what Save compares and stores. */
function nodesAtRest(nodes: FlowNode[]): unknown[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.type === "agent" ? { ...node.data, status: "idle", runsDone: 0 } : { status: "idle" },
  }));
}
