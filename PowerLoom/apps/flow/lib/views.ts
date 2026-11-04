import type { Flow } from "@powerloom/core/src/models/Flow";
import type { FlowExecution } from "@powerloom/core/src/models/FlowExecution";
import type { FlowExecutionStep } from "@powerloom/core/src/models/FlowExecutionStep";
import type { SavedDefinition } from "@/models/FlowDefinition";
import { executionProgress } from "./stepLooks";
import { agentUrl, pbiUrl, runUrl, taskUrl } from "./webUrl";

// What the pages send to the browser: the core models with dates as ISO strings and the web links already built
// (the server knows WEB_URL, the browser does not).

export interface ExecutionBrief {
  id: string;
  status: FlowExecution["status"];
  startedAt: string;
}

export interface FlowSummary {
  id: string;
  name: string;
  version: number;
  agents: number;
  edges: number;
  updatedAt: string;
  lastExecution: ExecutionBrief | null;
}

export interface StepView extends FlowExecutionStep {
  /** The task's page in the web app; null while the step has no task. */
  taskUrl: string | null;
  /** The task's latest run in the web app; null without a run. */
  runUrl: string | null;
  agentUrl: string;
}

export interface TargetView {
  kind: FlowExecution["targetKind"];
  label: string;
  url: string;
}

export interface ExecutionView {
  id: string;
  flowId: string;
  flowName: string;
  flowVersion: number;
  status: FlowExecution["status"];
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  target: TargetView;
  definition: SavedDefinition;
  steps: StepView[];
  progress: { done: number; total: number };
}

export function flowSummaryOf(flow: Flow, lastExecution: FlowExecution | null): FlowSummary {
  return {
    id: flow.id,
    name: flow.name,
    version: flow.version,
    agents: flow.definition.nodes.filter((node) => node.type === "agent").length,
    edges: flow.definition.edges.length,
    updatedAt: flow.updatedAt.toISOString(),
    lastExecution: lastExecution ? { id: lastExecution.id, status: lastExecution.status, startedAt: lastExecution.startedAt.toISOString() } : null,
  };
}

export function executionViewOf(execution: FlowExecution, flowName: string): ExecutionView {
  return {
    id: execution.id,
    flowId: execution.flowId,
    flowName,
    flowVersion: execution.flowVersion,
    status: execution.status,
    error: execution.error,
    startedAt: execution.startedAt.toISOString(),
    finishedAt: execution.finishedAt?.toISOString() ?? null,
    target: targetOf(execution),
    definition: execution.definition,
    steps: execution.steps.map((step) => stepViewOf(step, execution.pbiId)),
    progress: executionProgress(execution.steps),
  };
}

// A step's task sits on the execution's PBI; for a task target the web's /tasks/<id> page redirects to the PBI's when
// the task has one.
function stepViewOf(step: FlowExecutionStep, pbiId: number | null): StepView {
  return {
    ...step,
    taskUrl: step.itemId ? taskUrl(step.itemId, pbiId) : null,
    runUrl: step.lastRunId === null ? null : runUrl(step.lastRunId),
    agentUrl: agentUrl(step.agent),
  };
}

function targetOf(execution: FlowExecution): TargetView {
  if (execution.targetKind === "task" && execution.itemId) {
    return { kind: "task", label: execution.itemId, url: taskUrl(execution.itemId, execution.pbiId) };
  }

  const pbiId = execution.pbiId ?? 0;

  return { kind: "pbi", label: `PBI-${pbiId}`, url: pbiUrl(pbiId) };
}
