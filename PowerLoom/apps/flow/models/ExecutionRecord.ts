import type { NodeRunStatus } from "./FlowDefinition";

export type ExecutionStatus = "running" | "done" | "cancelled";

export interface ExecutionNodeRecord {
  nodeId: string;
  agentId: string;
  kind: string;
  title: string;
  runs: number;
  runsDone: number;
  status: NodeRunStatus;
}

/** One mocked execution, kept for the browser session (the /executions page). */
export interface ExecutionRecord {
  id: string;
  flowId: string;
  flowName: string;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt: string | null;
  nodes: ExecutionNodeRecord[];
}
