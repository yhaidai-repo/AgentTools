import { JOB_STAGES, NOT_FAILED_OUTCOMES } from "@powerloom/core";
import { agentRun } from "@powerloom/db";
import type { UsageRecord } from "@agenttools/usage";
import { and, eq, gte, notInArray, sql } from "drizzle-orm";
import type { AgentActivity } from "@/models/AgentActivity";
import type { DayActivity } from "@/models/DayActivity";
import { getDb } from "./db";
import { getUsageStore } from "./usage";

const MAX_RECORDS = 5_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const FAILURE_FILTER = notInArray(agentRun.outcome, NOT_FAILED_OUTCOMES);
const BUDGET_STOP_FILTER = eq(agentRun.outcome, "budget-exceeded");

interface RunDay {
  day: string;
  runs: number;
  failures: number;
  budgetStops: number;
}

interface RunTotals {
  agentId: string;
  runs: number;
  failures: number;
}

// Every day from `from` to today (budget days, 00:00 UTC), all vaults: the dashboard shows the whole system, and the
// daily budgets count every vault.
export async function loadDailyActivity(from: Date, now: Date): Promise<DayActivity[]> {
  const days = new Map(dayKeys(from, now).map((day) => [day, { day, runs: 0, failures: 0, budgetStops: 0, costByAgent: {} } as DayActivity]));

  for (const row of await runsPerDay(from)) {
    const day = days.get(row.day);

    if (day) {
      day.runs = row.runs;
      day.failures = row.failures;
      day.budgetStops = row.budgetStops;
    }
  }

  for (const record of await usageRecords(from)) {
    addCost(days.get(dayKey(record.startedAt)), record);
  }

  return [...days.values()];
}

// Per agent in the period, all vaults.
export async function loadAgentActivity(from: Date): Promise<Map<string, AgentActivity>> {
  const byAgent = new Map<string, AgentActivity>();

  for (const row of await runsPerAgent(from)) {
    byAgent.set(row.agentId, { ...activityOf(byAgent, row.agentId), runs: row.runs, failures: row.failures });
  }

  for (const record of await usageRecords(from)) {
    byAgent.set(agentOf(record), addUsage(activityOf(byAgent, agentOf(record)), record));
  }

  return byAgent;
}

async function runsPerDay(from: Date): Promise<RunDay[]> {
  const day = sql<string>`to_char(${agentRun.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

  return getDb()
    .select({
      day,
      runs: sql<number>`count(*)::int`,
      failures: sql<number>`(count(*) FILTER (WHERE ${FAILURE_FILTER}))::int`,
      budgetStops: sql<number>`(count(*) FILTER (WHERE ${BUDGET_STOP_FILTER}))::int`,
    })
    .from(agentRun)
    .where(and(gte(agentRun.startedAt, from), notInArray(agentRun.stage, JOB_STAGES)))
    .groupBy(day);
}

async function runsPerAgent(from: Date): Promise<RunTotals[]> {
  return getDb()
    .select({
      agentId: agentRun.stage,
      runs: sql<number>`count(*)::int`,
      failures: sql<number>`(count(*) FILTER (WHERE ${FAILURE_FILTER}))::int`,
    })
    .from(agentRun)
    .where(and(gte(agentRun.startedAt, from), notInArray(agentRun.stage, JOB_STAGES)))
    .groupBy(agentRun.stage);
}

function usageRecords(from: Date): Promise<UsageRecord[]> {
  return getUsageStore().records({ from }, MAX_RECORDS);
}

function addCost(day: DayActivity | undefined, record: UsageRecord): void {
  if (!day) {
    return;
  }

  const agent = agentOf(record);

  day.costByAgent[agent] = (day.costByAgent[agent] ?? 0) + record.costUsd;
}

function activityOf(byAgent: Map<string, AgentActivity>, agentId: string): AgentActivity {
  return byAgent.get(agentId) ?? { agentId, runs: 0, failures: 0, finishedRuns: 0, costUsd: 0, tokens: 0, durationMs: 0 };
}

function addUsage(activity: AgentActivity, record: UsageRecord): AgentActivity {
  const tokens = record.inputTokens + record.outputTokens + record.cacheReadTokens + record.cacheWriteTokens;

  return {
    ...activity,
    finishedRuns: activity.finishedRuns + 1,
    costUsd: activity.costUsd + record.costUsd,
    tokens: activity.tokens + tokens,
    durationMs: activity.durationMs + record.durationMs,
  };
}

function agentOf(record: UsageRecord): string {
  return String(record.labels.agent ?? "");
}

function dayKeys(from: Date, now: Date): string[] {
  const keys: string[] = [];

  for (let time = startOfUtcDay(from); time <= now.getTime(); time += DAY_MS) {
    keys.push(dayKey(new Date(time)));
  }

  return keys;
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
