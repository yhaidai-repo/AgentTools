import { JOB_STAGES } from "@powerloom/core";
import { agentRun } from "@powerloom/db";
import { and, desc, gte, notInArray, sql } from "drizzle-orm";
import type { FailedRun } from "@/models/FailedRun";
import { getDb } from "./db";

// The agents' last failed runs in the period (any outcome but success, no-op and running), newest first.
export async function loadRecentFailures(from: Date, limit: number): Promise<FailedRun[]> {
  const rows = await getDb()
    .select({ id: agentRun.id, agentId: agentRun.stage, itemId: agentRun.itemId, pbiId: agentRun.pbiId, startedAt: agentRun.startedAt, outcome: agentRun.outcome, error: agentRun.error })
    .from(agentRun)
    .where(and(gte(agentRun.startedAt, from), notInArray(agentRun.stage, JOB_STAGES), sql`${agentRun.outcome} NOT IN ('success', 'no-op', 'running')`))
    .orderBy(desc(agentRun.id))
    .limit(limit);

  return rows.map((row) => ({ ...row, startedAt: new Date(row.startedAt) }));
}
