import { JOB_STAGES, NOT_FAILED_OUTCOMES, USER_STOP_OUTCOME } from "@powerloom/core";
import { agentRun, localItem, workItem } from "@powerloom/db";
import type { UsageRecord } from "@agenttools/usage";
import { and, eq, gte, notInArray, sql } from "drizzle-orm";
import type { AgentActivity } from "@/models/AgentActivity";
import type { DayActivity } from "@/models/DayActivity";
import { getDb } from "./db";
import { getUsageStore } from "./usage";
import { runInVault, vaultRunIds } from "./vaultRuns";

const DAY_MS = 24 * 60 * 60 * 1000;
const FAILURE_FILTER = notInArray(agentRun.outcome, NOT_FAILED_OUTCOMES);
const BUDGET_STOP_FILTER = eq(agentRun.outcome, "budget-exceeded");
const USER_STOP_FILTER = eq(agentRun.outcome, USER_STOP_OUTCOME);

interface RunDay {
  day: string;
  runs: number;
  failures: number;
  budgetStops: number;
  userStops: number;
}

interface RunTotals {
  agentId: string;
  runs: number;
  failures: number;
}

// Every day from `from` to today (budget days, 00:00 UTC) of the vault's runs (user decision 2026-10-18: the
// dashboard shows the selected vault): runs from the run table; cost, tokens and run time per agent from the finished
// runs' usage records.
export async function loadDailyActivity(from: Date, now: Date, vault: string): Promise<DayActivity[]> {
  const days = new Map(dayKeys(from, now).map((day) => [day, emptyDay(day)]));

  for (const row of await runsPerDay(from, vault)) {
    setRuns(days.get(row.day), row);
  }

  for (const record of await vaultRecords(from, vault)) {
    addDayUsage(days.get(dayKey(record.startedAt)), record);
  }

  return [...days.values()];
}

// Per agent in the period, the vault's runs.
export async function loadAgentActivity(from: Date, vault: string): Promise<Map<string, AgentActivity>> {
  const byAgent = new Map<string, AgentActivity>();

  for (const row of await runsPerAgent(from, vault)) {
    byAgent.set(row.agentId, { ...activityOf(byAgent, row.agentId), runs: row.runs, failures: row.failures });
  }

  for (const record of await vaultRecords(from, vault)) {
    byAgent.set(agentOf(record), addUsage(activityOf(byAgent, agentOf(record)), record));
  }

  return byAgent;
}

async function runsPerDay(from: Date, vault: string): Promise<RunDay[]> {
  const day = sql<string>`to_char(${agentRun.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

  return getDb()
    .select({
      day,
      runs: sql<number>`count(*)::int`,
      failures: sql<number>`(count(*) FILTER (WHERE ${FAILURE_FILTER}))::int`,
      budgetStops: sql<number>`(count(*) FILTER (WHERE ${BUDGET_STOP_FILTER}))::int`,
      userStops: sql<number>`(count(*) FILTER (WHERE ${USER_STOP_FILTER}))::int`,
    })
    .from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(workItem, eq(workItem.adoId, agentRun.pbiId))
    .where(and(gte(agentRun.startedAt, from), notInArray(agentRun.stage, JOB_STAGES), runInVault(vault)))
    .groupBy(day);
}

async function runsPerAgent(from: Date, vault: string): Promise<RunTotals[]> {
  return getDb()
    .select({
      agentId: agentRun.stage,
      runs: sql<number>`count(*)::int`,
      failures: sql<number>`(count(*) FILTER (WHERE ${FAILURE_FILTER}))::int`,
    })
    .from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(workItem, eq(workItem.adoId, agentRun.pbiId))
    .where(and(gte(agentRun.startedAt, from), notInArray(agentRun.stage, JOB_STAGES), runInVault(vault)))
    .groupBy(agentRun.stage);
}

async function vaultRecords(from: Date, vault: string): Promise<UsageRecord[]> {
  const runIds = await vaultRunIds(from, vault);
  return runIds.size === 0 ? [] : getUsageStore().records({ from, runIds: [...runIds] });
}

function emptyDay(day: string): DayActivity {
  return { day, runs: 0, failures: 0, budgetStops: 0, userStops: 0, costByAgent: {}, tokensByAgent: {}, durationMsByAgent: {} };
}

function setRuns(day: DayActivity | undefined, row: RunDay): void {
  if (!day) {
    return;
  }

  day.runs = row.runs;
  day.failures = row.failures;
  day.budgetStops = row.budgetStops;
  day.userStops = row.userStops;
}

function addDayUsage(day: DayActivity | undefined, record: UsageRecord): void {
  if (!day) {
    return;
  }

  const agent = agentOf(record);

  day.costByAgent[agent] = (day.costByAgent[agent] ?? 0) + record.costUsd;
  day.accountingComplete = day.accountingComplete !== false && record.accountingComplete !== false;
  day.tokensByAgent[agent] = (day.tokensByAgent[agent] ?? 0) + tokensOf(record);
  day.durationMsByAgent[agent] = (day.durationMsByAgent[agent] ?? 0) + record.durationMs;
}

function activityOf(byAgent: Map<string, AgentActivity>, agentId: string): AgentActivity {
  return byAgent.get(agentId) ?? { agentId, runs: 0, failures: 0, finishedRuns: 0, costUsd: 0, tokens: 0, durationMs: 0 };
}

function addUsage(activity: AgentActivity, record: UsageRecord): AgentActivity {
  return {
    ...activity,
    finishedRuns: activity.finishedRuns + 1,
    costUsd: activity.costUsd + record.costUsd,
    accountingComplete: activity.accountingComplete !== false && record.accountingComplete !== false,
    tokens: activity.tokens + tokensOf(record),
    durationMs: activity.durationMs + record.durationMs,
  };
}

function tokensOf(record: UsageRecord): number {
  return record.inputTokens + record.outputTokens + record.cacheReadTokens + record.cacheWriteTokens;
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
