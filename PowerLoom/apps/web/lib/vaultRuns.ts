import { JOB_STAGES } from "@powerloom/core";
import { agentRun, localItem, workItem } from "@powerloom/db";
import type { UsageRecord } from "@agenttools/usage";
import { and, gte, notInArray, type SQL, sql } from "drizzle-orm";
import { getDb } from "./db";

// A run belongs to the vault of its task, or of its PBI when it has no task. The query must left-join local_item on
// the run's item and work_item on its PBI.
export function runInVault(vault: string): SQL {
  return sql`coalesce(${localItem.vault}, ${workItem.vault}) = ${vault}`;
}

// The ids of the vault's agent runs since `from`, as usage records key them (text).
export async function vaultRunIds(from: Date, vault: string): Promise<Set<string>> {
  const rows = await getDb()
    .select({ id: agentRun.id })
    .from(agentRun)
    .leftJoin(localItem, sql`${localItem.id} = ${agentRun.itemId}`)
    .leftJoin(workItem, sql`${workItem.adoId} = ${agentRun.pbiId}`)
    .where(and(runInVault(vault), gte(agentRun.startedAt, from), notInArray(agentRun.stage, JOB_STAGES)));

  return new Set(rows.map((row) => String(row.id)));
}

// Usage records are keyed by run, so the vault's run ids pick its records.
export function inVaultRuns(records: UsageRecord[], runIds: Set<string>): UsageRecord[] {
  return records.filter((record) => runIds.has(record.runId));
}
