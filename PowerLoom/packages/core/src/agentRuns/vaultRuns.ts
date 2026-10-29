import type { UsageRecord } from "@agenttools/usage";
import { agentRun, localItem, workItem, type PowerLoomDb } from "@powerloom/db";
import { and, desc, eq, gte, notInArray, type SQL, sql } from "drizzle-orm";
import { JOB_STAGES } from "../runs";

// A run belongs to the vault of its task, or of its PBI when it has no task. The query must left-join local_item on
// the run's item and work_item on its PBI.
export function runInVault(vault: string): SQL {
  return sql`coalesce(${localItem.vault}, ${workItem.vault}) = ${vault}`;
}

// The ids of the vault's agent runs since `from`, as usage records key them (text).
export async function vaultRunIds(db: PowerLoomDb, from: Date, vault: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: agentRun.id })
    .from(agentRun)
    .leftJoin(localItem, sql`${localItem.id} = ${agentRun.itemId}`)
    .leftJoin(workItem, sql`${workItem.adoId} = ${agentRun.pbiId}`)
    .where(and(runInVault(vault), gte(agentRun.startedAt, from), notInArray(agentRun.stage, JOB_STAGES)));

  return new Set(rows.map((row) => String(row.id)));
}

// The newest runs of one agent in the vault, with how each ended.
export async function latestVaultRunsOfAgent(db: PowerLoomDb, vault: string, agentId: string, limit: number): Promise<{ id: number; startedAt: Date; outcome: string }[]> {
  return db
    .select({ id: agentRun.id, startedAt: agentRun.startedAt, outcome: agentRun.outcome })
    .from(agentRun)
    .leftJoin(localItem, sql`${localItem.id} = ${agentRun.itemId}`)
    .leftJoin(workItem, sql`${workItem.adoId} = ${agentRun.pbiId}`)
    .where(and(runInVault(vault), eq(agentRun.stage, agentId)))
    .orderBy(desc(agentRun.startedAt))
    .limit(limit);
}

// Usage records are keyed by run, so the vault's run ids pick its records.
export function inVaultRuns(records: UsageRecord[], runIds: Set<string>): UsageRecord[] {
  return records.filter((record) => runIds.has(record.runId));
}

// How the pages and the chat name a run.
export function runRef(id: number): string {
  return `RUN-${id}`;
}
