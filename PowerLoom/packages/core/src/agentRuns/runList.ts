import type { UsageRecord, UsageStore } from "@agenttools/usage";
import { agentRun, localItem, workItem, type PowerLoomDb } from "@powerloom/db";
import { and, desc, eq, gte, notInArray, type SQL } from "drizzle-orm";
import type { RunListFilter } from "../models/RunListFilter";
import type { RunListRow } from "../models/RunListRow";
import { JOB_STAGES } from "../runs";
import { runInVault } from "./vaultRuns";

export const MAX_RUNS = 200;

// Agent runs (job runs, e.g. sync and pull request checks, are the worker's, not an agent's) with the task each one
// worked on, newest first.
export async function loadRunList(db: PowerLoomDb, usage: UsageStore, filter: RunListFilter, from: Date, vault: string): Promise<RunListRow[]> {
  const runs = await db
    .select({ run: agentRun, task: localItem })
    .from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(workItem, eq(workItem.adoId, agentRun.pbiId))
    .where(and(runInVault(vault), ...runConditions(filter, from)))
    .orderBy(desc(agentRun.id))
    .limit(MAX_RUNS);
  const usageRecords = await usageByRun(usage, from);

  return runs.map(({ run, task }) => ({ run, task, usage: usageRecords.get(String(run.id)) ?? null }));
}

function runConditions(filter: RunListFilter, from: Date): SQL[] {
  const conditions: SQL[] = [notInArray(agentRun.stage, JOB_STAGES), gte(agentRun.startedAt, from)];

  if (filter.agent) {
    conditions.push(eq(agentRun.stage, filter.agent));
  }

  if (filter.outcome) {
    conditions.push(eq(agentRun.outcome, filter.outcome as (typeof agentRun.$inferSelect)["outcome"]));
  }

  return conditions;
}

async function usageByRun(usage: UsageStore, from: Date): Promise<Map<string, UsageRecord>> {
  const records = await usage.records({ from }, MAX_RUNS * 2);

  return new Map(records.map((record) => [record.runId, record]));
}
