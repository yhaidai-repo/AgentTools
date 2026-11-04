import { readFlow, readFlowExecution, readFlowExecutions, readFlows } from "@powerloom/core/src/flows";
import { getDb } from "./db";
import { executionViewOf, flowSummaryOf, type ExecutionView, type FlowSummary } from "./views";

// The pages' reads (core's drizzle reads with the app's database), shaped for the browser.

// The vault's flows, latest change first, each with its newest execution.
export async function listFlows(vault: string): Promise<FlowSummary[]> {
  const db = getDb();
  const [flows, executions] = await Promise.all([readFlows(db, vault), readFlowExecutions(db, vault, { limit: 500 })]);
  const latest = new Map<string, (typeof executions)[number]>();

  // Newest first: the first execution seen per flow is its latest.
  for (const execution of executions) {
    if (!latest.has(execution.flowId)) latest.set(execution.flowId, execution);
  }

  return flows.map((flow) => flowSummaryOf(flow, latest.get(flow.id) ?? null));
}

export function getFlow(id: string, vault: string) {
  return readFlow(getDb(), id, vault);
}

export async function listExecutions(vault: string, flowId: string | null): Promise<ExecutionView[]> {
  const db = getDb();
  const [executions, flows] = await Promise.all([readFlowExecutions(db, vault, { flowId, limit: 200 }), readFlows(db, vault)]);
  const names = new Map(flows.map((flow) => [flow.id, flow.name]));

  return executions.map((execution) => executionViewOf(execution, names.get(execution.flowId) ?? execution.flowId));
}

export async function getExecution(id: string, vault: string): Promise<ExecutionView | null> {
  const db = getDb();
  const execution = await readFlowExecution(db, id, vault);

  if (!execution) return null;

  const flow = await readFlow(db, execution.flowId, vault);

  return executionViewOf(execution, flow?.name ?? execution.flowId);
}
