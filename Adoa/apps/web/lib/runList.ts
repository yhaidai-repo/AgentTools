import { JOB_STAGES } from "@adoa/core";
import { agentRun, localItem } from "@adoa/db";
import type { UsageRecord } from "@agenttools/usage";
import { and, desc, eq, gte, notInArray, type SQL } from "drizzle-orm";
import type { RunListFilter } from "@/models/RunListFilter";
import { getDb } from "./db";
import { getUsageStore } from "./usage";

const MAX_RUNS = 200;

// Agent runs (job runs, e.g. sync and pull request checks, are the worker's, not an agent's) with the task each one worked on, newest first.
export async function loadRunList(filter: RunListFilter, from: Date) {
  const runs = await getDb()
    .select({ run: agentRun, task: localItem })
    .from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .where(and(...runConditions(filter, from)))
    .orderBy(desc(agentRun.id))
    .limit(MAX_RUNS);
  const usage = await usageByRun(from);

  return runs.map(({ run, task }) => ({ run, task, usage: usage.get(String(run.id)) ?? null }));
}

function runConditions(filter: RunListFilter, from: Date): SQL[] {
  const conditions: SQL[] = [notInArray(agentRun.stage, JOB_STAGES), gte(agentRun.startedAt, from)];

  if (filter.agent) {
    conditions.push(eq(agentRun.stage, filter.agent as typeof agentRun.$inferSelect["stage"]));
  }

  if (filter.outcome) {
    conditions.push(eq(agentRun.outcome, filter.outcome as typeof agentRun.$inferSelect["outcome"]));
  }

  return conditions;
}

async function usageByRun(from: Date): Promise<Map<string, UsageRecord>> {
  const records = await getUsageStore().records({ from }, MAX_RUNS * 2);

  return new Map(records.map((record) => [record.runId, record]));
}

export type RunListRow = Awaited<ReturnType<typeof loadRunList>>[number];
