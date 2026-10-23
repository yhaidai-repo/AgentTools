import type { UsageRecord, UsageStore } from "@agenttools/usage";
import type { PowerLoomDb } from "@powerloom/db";
import { inVaultRuns, vaultRunIds } from "../agentRuns/vaultRuns";
import type { AgentTotals } from "../models/AgentTotals";

const MAX_RECORDS = 5_000;

const NO_USAGE: AgentTotals = { runs: 0, tokens: 0, costUsd: 0, durationMs: 0 };

// Per agent, the usage of the vault's runs in the period (user decision 2026-10-06: the Agents page shows the selected
// vault): usage records are keyed by run, so the vault's run ids pick them.
export async function loadAgentTotals(db: PowerLoomDb, usage: UsageStore, from: Date, vault: string): Promise<Map<string, AgentTotals>> {
  const runIds = await vaultRunIds(db, from, vault);
  const records = inVaultRuns(await usage.records({ from }, MAX_RECORDS), runIds);
  const totals = new Map<string, AgentTotals>();

  for (const record of records) {
    const agent = String(record.labels.agent ?? "");

    totals.set(agent, add(totals.get(agent), record));
  }

  return totals;
}

// What a PBI's runs spent in all (user request 2026-10-13: total agent time and cost on the PBI page). Usage records
// start with their run, so the PBI's earliest run bounds the read.
export async function loadRunTotals(usage: UsageStore, runs: { id: number; startedAt: Date }[]): Promise<AgentTotals> {
  if (runs.length === 0) {
    return NO_USAGE;
  }

  const runIds = new Set(runs.map((run) => String(run.id)));
  const from = new Date(Math.min(...runs.map((run) => run.startedAt.getTime())));
  const records = (await usage.records({ from }, MAX_RECORDS)).filter((record) => runIds.has(record.runId));

  return records.reduce(add, NO_USAGE);
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
