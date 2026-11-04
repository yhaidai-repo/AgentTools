import { agentRun, flow, flowExecution, localItem, type PowerLoomDb } from "@powerloom/db";
import { and, count, desc, eq, inArray, max, ne, sql } from "drizzle-orm";
import { flowStepsOf, type FlowTaskRow } from "./flowSteps";
import type { Flow } from "./models/Flow";
import { flowDefinitionSchema, type FlowDefinition } from "./models/FlowDefinition";
import type { FlowExecution } from "./models/FlowExecution";

// Flows and their executions are saved through PowerLoom (the Flows feature); the Flow app reads them here, as the web
// reads its pages. A row's definition is parsed with the one schema, so a page never sees a shape the API didn't write.
// An execution's steps come from its tasks (data.flowExecutionId) and their runs, as the backend's view computes them.

export async function readFlows(db: PowerLoomDb, vault: string): Promise<Flow[]> {
  const rows = await db.select().from(flow).where(eq(flow.vault, vault)).orderBy(desc(flow.updatedAt), flow.id);

  return rows.map(flowOf);
}

export async function readFlow(db: PowerLoomDb, id: string, vault: string): Promise<Flow | null> {
  const [row] = await db.select().from(flow).where(and(eq(flow.id, id), eq(flow.vault, vault)));

  return row ? flowOf(row) : null;
}

// Newest first; `flowId` narrows to one flow.
export async function readFlowExecutions(db: PowerLoomDb, vault: string, options: { flowId?: string | null; limit?: number } = {}): Promise<FlowExecution[]> {
  const where = options.flowId ? and(eq(flowExecution.vault, vault), eq(flowExecution.flowId, options.flowId)) : eq(flowExecution.vault, vault);
  const rows = await db.select().from(flowExecution).where(where).orderBy(desc(flowExecution.startedAt), desc(flowExecution.id)).limit(options.limit ?? 50);
  const tasks = await readExecutionTasks(db, rows.map((row) => row.id));

  return rows.map((row) => executionOf(row, tasks.get(row.id) ?? []));
}

export async function readFlowExecution(db: PowerLoomDb, id: string, vault: string): Promise<FlowExecution | null> {
  const [row] = await db.select().from(flowExecution).where(and(eq(flowExecution.id, id), eq(flowExecution.vault, vault)));

  if (!row) return null;

  const tasks = await readExecutionTasks(db, [row.id]);

  return executionOf(row, tasks.get(row.id) ?? []);
}

export function flowOf(row: typeof flow.$inferSelect): Flow {
  return { id: row.id, vault: row.vault, name: row.name, version: row.version, definition: definitionOf(row.definition), createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export function executionOf(row: typeof flowExecution.$inferSelect, tasks: readonly FlowTaskRow[] = []): FlowExecution {
  const definition = definitionOf(row.definition);

  return {
    id: row.id,
    flowId: row.flowId,
    flowVersion: row.flowVersion,
    vault: row.vault,
    targetKind: row.targetKind,
    pbiId: row.pbiId,
    itemId: row.itemId,
    status: row.status,
    error: row.error,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    definition,
    steps: flowStepsOf(row.id, row.status, definition, tasks),
  };
}

// Every task of the executions (a deleted one is gone for the flow too) with its run count and latest run, by execution,
// oldest first.
async function readExecutionTasks(db: PowerLoomDb, executionIds: string[]): Promise<Map<string, FlowTaskRow[]>> {
  const byExecution = new Map<string, FlowTaskRow[]>();

  if (executionIds.length === 0) return byExecution;

  const executionId = sql<string>`${localItem.data}->>'flowExecutionId'`;
  const rows = await db
    .select({ id: localItem.id, kind: localItem.kind, status: localItem.status, assignee: localItem.assignee, parentId: localItem.parentId, data: localItem.data, executionId, runs: count(agentRun.id), lastRunId: max(agentRun.id) })
    .from(localItem)
    .leftJoin(agentRun, eq(agentRun.itemId, localItem.id))
    .where(and(inArray(executionId, executionIds), ne(localItem.status, "deleted")))
    .groupBy(localItem.id)
    .orderBy(localItem.createdAt, localItem.id);

  for (const row of rows) {
    const tasks = byExecution.get(row.executionId) ?? [];

    tasks.push({ id: row.id, kind: row.kind, status: row.status, assignee: row.assignee, parentId: row.parentId, data: row.data, runs: Number(row.runs), lastRunId: row.lastRunId === null ? null : Number(row.lastRunId) });
    byExecution.set(row.executionId, tasks);
  }

  return byExecution;
}

function definitionOf(json: unknown): FlowDefinition {
  return flowDefinitionSchema.parse(json);
}
