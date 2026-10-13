import { JOB_STAGES, NOT_FAILED_OUTCOMES } from "@powerloom/core";
import { agentRun } from "@powerloom/db";
import { and, desc, gte, notInArray } from "drizzle-orm";
import type { FailedRun } from "@/models/FailedRun";
import { getDb } from "./db";

// The agents' last failed runs in the period (NOT_FAILED_OUTCOMES left out: budget stops aren't failures), newest first.
export async function loadRecentFailures(from: Date, limit: number): Promise<FailedRun[]> {
  const rows = await getDb()
    .select({ id: agentRun.id, agentId: agentRun.stage, itemId: agentRun.itemId, pbiId: agentRun.pbiId, startedAt: agentRun.startedAt, outcome: agentRun.outcome, error: agentRun.error })
    .from(agentRun)
    .where(and(gte(agentRun.startedAt, from), notInArray(agentRun.stage, JOB_STAGES), notInArray(agentRun.outcome, NOT_FAILED_OUTCOMES)))
    .orderBy(desc(agentRun.id))
    .limit(limit);

  return rows.map((row) => ({ ...row, startedAt: new Date(row.startedAt) }));
}
