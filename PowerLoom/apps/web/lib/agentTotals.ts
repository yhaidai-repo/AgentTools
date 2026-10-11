import { JOB_STAGES } from "@powerloom/core";
import { agentRun, localItem, workItem } from "@powerloom/db";
import type { UsageRecord } from "@agenttools/usage";
import { and, gte, notInArray, sql } from "drizzle-orm";
import type { AgentTotals } from "@/models/AgentTotals";
import { getDb } from "./db";
import { getUsageStore } from "./usage";

const MAX_RECORDS = 5_000;

// Per agent, the usage of the vault's runs in the period (user decision 2026-10-06: the Agents page shows the selected
// vault): usage records are keyed by run, so the vault's run ids pick them.
export async function loadAgentTotals(from: Date, vault: string): Promise<Map<string, AgentTotals>> {
  const runIds = await vaultRunIds(from, vault);
  const records = (await getUsageStore().records({ from }, MAX_RECORDS)).filter((record) => runIds.has(record.runId));
  const totals = new Map<string, AgentTotals>();

  for (const record of records) {
    const agent = String(record.labels.agent ?? "");

    totals.set(agent, add(totals.get(agent), record));
  }

  return totals;
}

// A run belongs to the vault of its task, or of its PBI when it has no task.
async function vaultRunIds(from: Date, vault: string): Promise<Set<string>> {
  const rows = await getDb()
    .select({ id: agentRun.id })
    .from(agentRun)
    .leftJoin(localItem, sql`${localItem.id} = ${agentRun.itemId}`)
    .leftJoin(workItem, sql`${workItem.adoId} = ${agentRun.pbiId}`)
    .where(and(sql`coalesce(${localItem.vault}, ${workItem.vault}) = ${vault}`, gte(agentRun.startedAt, from), notInArray(agentRun.stage, JOB_STAGES)));

  return new Set(rows.map((row) => String(row.id)));
}

function add(totals: AgentTotals | undefined, record: UsageRecord): AgentTotals {
  const tokens = record.inputTokens + record.outputTokens + record.cacheReadTokens + record.cacheWriteTokens;

  return {
    runs: (totals?.runs ?? 0) + 1,
    tokens: (totals?.tokens ?? 0) + tokens,
    costUsd: (totals?.costUsd ?? 0) + record.costUsd,
    durationMs: (totals?.durationMs ?? 0) + record.durationMs,
  };
}
