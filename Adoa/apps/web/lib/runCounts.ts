import { JOB_STAGES } from "@adoa/core";
import { agentRun } from "@adoa/db";
import { notInArray, sql } from "drizzle-orm";
import type { RunCounts } from "@/models/RunCounts";
import { getDb } from "./db";

// Per stage (= agent id), in the period, plus all-time runs. Failures: every outcome but success, no-op and running.
export async function loadRunCounts(from: Date): Promise<Map<string, RunCounts>> {
  const inPeriod = sql`${agentRun.startedAt} >= ${from}`;
  const rows = await getDb()
    .select({
      stage: agentRun.stage,
      runs: sql<number>`(count(*) FILTER (WHERE ${inPeriod}))::int`,
      totalRuns: sql<number>`count(*)::int`,
      running: sql<number>`(count(*) FILTER (WHERE ${inPeriod} AND ${agentRun.outcome} = 'running'))::int`,
      failures: sql<number>`(count(*) FILTER (WHERE ${inPeriod} AND ${agentRun.outcome} NOT IN ('success', 'no-op', 'running')))::int`,
      lastStartedAt: sql<Date>`max(${agentRun.startedAt}) FILTER (WHERE ${inPeriod})`,
      lastOutcome: sql<string>`(array_agg(${agentRun.outcome} ORDER BY ${agentRun.startedAt} DESC) FILTER (WHERE ${inPeriod}))[1]`,
    })
    .from(agentRun)
    .where(notInArray(agentRun.stage, JOB_STAGES))
    .groupBy(agentRun.stage);

  return new Map(rows.map((row) => [row.stage, { ...row, lastStartedAt: row.lastStartedAt ? new Date(row.lastStartedAt) : null }]));
}
