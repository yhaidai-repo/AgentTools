import { flow, flowExecution, type PowerLoomDb } from "@powerloom/db";
import { and, desc, eq } from "drizzle-orm";
import type { Flow } from "./models/Flow";
import { flowDefinitionSchema, type FlowDefinition } from "./models/FlowDefinition";
import type { FlowExecution } from "./models/FlowExecution";

// Flows and their executions are saved through PowerLoom (the Flows feature); the Flow app reads them here, as the web
// reads its pages. A row's definition is parsed with the one schema, so a page never sees a shape the API didn't write.

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

  return rows.map(executionOf);
}

export async function readFlowExecution(db: PowerLoomDb, id: string, vault: string): Promise<FlowExecution | null> {
  const [row] = await db.select().from(flowExecution).where(and(eq(flowExecution.id, id), eq(flowExecution.vault, vault)));

  return row ? executionOf(row) : null;
}

export function flowOf(row: typeof flow.$inferSelect): Flow {
  return { id: row.id, vault: row.vault, name: row.name, version: row.version, definition: definitionOf(row.definition), createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export function executionOf(row: typeof flowExecution.$inferSelect): FlowExecution {
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
    definition: definitionOf(row.definition),
  };
}

function definitionOf(json: unknown): FlowDefinition {
  return flowDefinitionSchema.parse(json);
}
