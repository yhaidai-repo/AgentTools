import { agentRun } from "@adoa/db";
import { and, gte, ne, sql } from "drizzle-orm";
import type { RunCounts } from "@/models/RunCounts";
import { getDb } from "./db";

// Per stage (= agent id). Failures: every outcome but success, no-op and running.
export async function loadRunCounts(from: Date): Promise<Map<string, RunCounts>> {
  const rows = await getDb()
    .select({
      stage: agentRun.stage,
      runs: sql<number>`count(*)::int`,
      running: sql<number>`(count(*) FILTER (WHERE ${agentRun.outcome} = 'running'))::int`,
      failures: sql<number>`(count(*) FILTER (WHERE ${agentRun.outcome} NOT IN ('success', 'no-op', 'running')))::int`,
      lastStartedAt: sql<Date>`max(${agentRun.startedAt})`,
      lastOutcome: sql<string>`(array_agg(${agentRun.outcome} ORDER BY ${agentRun.startedAt} DESC))[1]`,
    })
    .from(agentRun)
    .where(and(gte(agentRun.startedAt, from), ne(agentRun.stage, "sync")))
    .groupBy(agentRun.stage);

  return new Map(rows.map((row) => [row.stage, { ...row, lastStartedAt: row.lastStartedAt ? new Date(row.lastStartedAt) : null }]));
}
