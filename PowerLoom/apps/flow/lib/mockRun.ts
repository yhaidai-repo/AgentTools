import type { FlowEdge, FlowNode, NodeRunStatus } from "@/models/FlowDefinition";
import { TRIGGER_NODE_ID } from "@/models/FlowDefinition";

export interface NodeRunSnapshot {
  status: NodeRunStatus;
  runs: number;
  runsDone: number;
}

export interface RunSnapshot {
  nodes: Record<string, NodeRunSnapshot>;
  /** Runs played over runs planned, the trigger counting as one. */
  progress: { done: number; total: number };
  finished: boolean;
}

export interface MockRunOptions {
  /** One mocked run of a node takes this long. */
  runMs?: number;
  onSnapshot: (snapshot: RunSnapshot) => void;
}

// The mocked execution (phase 0, nothing reaches PowerLoom): the trigger fires, then every tick each running node plays one
// run; a node with all its runs played is done. A waiting node starts once every required predecessor is done and at
// least one predecessor (required or optional) is done; a node without incoming edges starts with the trigger.
// Optional edges therefore start their target too, but never hold it back. Nodes nobody reaches stay "waiting".
export function startMockRun(nodes: FlowNode[], edges: FlowEdge[], options: MockRunOptions): () => void {
  const runMs = options.runMs ?? 1000;
  const state = new Map<string, NodeRunSnapshot>();
  const incoming = new Map<string, FlowEdge[]>();

  for (const node of nodes) {
    state.set(node.id, { status: "waiting", runs: node.type === "agent" ? Math.max(1, node.data.runs) : 1, runsDone: 0 });
    incoming.set(node.id, []);
  }

  for (const edge of edges) {
    if (state.has(edge.source) && state.has(edge.target)) incoming.get(edge.target)!.push(edge);
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const emit = (finished: boolean) => {
    let done = 0;
    let total = 0;

    for (const snapshot of state.values()) {
      done += snapshot.runsDone;
      total += snapshot.runs;
    }

    options.onSnapshot({ nodes: Object.fromEntries([...state].map(([id, snapshot]) => [id, { ...snapshot }])), progress: { done, total }, finished });
  };

  const isDone = (id: string) => state.get(id)?.status === "done";

  const ready = (id: string): boolean => {
    if (id === TRIGGER_NODE_ID) return true;

    const edgesIn = incoming.get(id) ?? [];

    if (edgesIn.length === 0) return isDone(TRIGGER_NODE_ID);

    const requiredDone = edgesIn.filter((edge) => edge.data?.kind !== "optional").every((edge) => isDone(edge.source));
    const anyDone = edgesIn.some((edge) => isDone(edge.source));

    return requiredDone && anyDone;
  };

  const startReady = () => {
    for (const [id, snapshot] of state) {
      if (snapshot.status === "waiting" && ready(id)) snapshot.status = "running";
    }
  };

  const tick = () => {
    if (cancelled) return;

    for (const snapshot of state.values()) {
      if (snapshot.status !== "running") continue;

      snapshot.runsDone += 1;
      if (snapshot.runsDone >= snapshot.runs) snapshot.status = "done";
    }

    startReady();

    const running = [...state.values()].some((snapshot) => snapshot.status === "running");

    emit(!running);
    if (running) timer = setTimeout(tick, runMs);
  };

  // The trigger fires first; its single run is the first tick.
  state.get(TRIGGER_NODE_ID)!.status = "running";
  emit(false);
  timer = setTimeout(tick, Math.round(runMs * 0.6));

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
