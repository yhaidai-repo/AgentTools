import { CHAT_STAGE, JOB_STAGES } from "@powerloom/core";
import { agentRun, localItem, workItem } from "@powerloom/db";
import type { UsageRecord } from "@agenttools/usage";
import { and, eq, gte, like, notInArray, or, type SQL, sql } from "drizzle-orm";
import { getDb } from "./db";

// A run belongs to the vault of its task, or of its PBI when it has no task; a chat session's run (no task, no PBI)
// names its vault itself. The query must left-join local_item on the run's item and work_item on its PBI.
export function runInVault(vault: string): SQL {
  return or(sql`coalesce(${localItem.vault}, ${workItem.vault}) = ${vault}`, chatRunInVault(vault))!;
}

// The chat run's input is `{"vault":…,"client":…}` (ChatRun), matched as text: other runs' inputs are prompts, not
// JSON, so a cast would fail (stage 1 shortcut; a vault column on agent_run is the clean way).
function chatRunInVault(vault: string): SQL {
  return and(eq(agentRun.stage, CHAT_STAGE), like(agentRun.input, `%${JSON.stringify({ vault }).slice(1, -1)}%`))!;
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
