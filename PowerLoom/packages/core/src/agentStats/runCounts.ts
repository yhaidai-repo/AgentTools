import { agentRun, localItem, workItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { RunCounts } from "../models/RunCounts";
import { JOB_STAGES, NOT_FAILED_OUTCOMES } from "../runs";

// Per stage (= agent id), in the period, plus all-time runs, for the selected vault's runs (a run belongs to the vault of
// its task, or of its PBI). Failures: every outcome but NOT_FAILED_OUTCOMES (budget stops aren't failures).
export async function loadRunCounts(db: PowerLoomDb, from: Date, vault: string): Promise<Map<string, RunCounts>> {
  const inPeriod = sql`${agentRun.startedAt} >= ${from}`;
  const rows = await db
    .select({
      stage: agentRun.stage,
      runs: sql<number>`(count(*) FILTER (WHERE ${inPeriod}))::int`,
      totalRuns: sql<number>`count(*)::int`,
      running: sql<number>`(count(*) FILTER (WHERE ${inPeriod} AND ${agentRun.outcome} = 'running'))::int`,
      failures: sql<number>`(count(*) FILTER (WHERE ${inPeriod} AND ${notInArray(agentRun.outcome, NOT_FAILED_OUTCOMES)}))::int`,
      lastStartedAt: sql<Date>`max(${agentRun.startedAt}) FILTER (WHERE ${inPeriod})`,
      lastOutcome: sql<string>`(array_agg(${agentRun.outcome} ORDER BY ${agentRun.startedAt} DESC) FILTER (WHERE ${inPeriod}))[1]`,
    })
    .from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(workItem, eq(workItem.adoId, agentRun.pbiId))
    .where(and(notInArray(agentRun.stage, JOB_STAGES), sql`coalesce(${localItem.vault}, ${workItem.vault}) = ${vault}`))
    .groupBy(agentRun.stage);

  return new Map(rows.map((row) => [row.stage, { ...row, lastStartedAt: row.lastStartedAt ? new Date(row.lastStartedAt) : null }]));
}
