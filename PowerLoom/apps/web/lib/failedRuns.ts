import { JOB_STAGES, NOT_FAILED_OUTCOMES } from "@powerloom/core";
import { agentRun, localItem, workItem } from "@powerloom/db";
import { and, desc, eq, gte, notInArray } from "drizzle-orm";
import type { FailedRun } from "@/models/FailedRun";
import type { FailureGroup } from "@/models/FailureGroup";
import { getDb } from "./db";
import { runInVault } from "./vaultRuns";

// How many failed runs are read to find the latest distinct errors.
const FAILURES_READ = 200;

// The vault's latest distinct failures in the period, newest first (user decision 2026-10-18: a repeated error is one
// row with its count). NOT_FAILED_OUTCOMES are left out: budget stops aren't failures.
export async function loadFailureGroups(from: Date, limit: number, vault: string): Promise<FailureGroup[]> {
  return groupFailures(await loadRecentFailures(from, vault)).slice(0, limit);
}

async function loadRecentFailures(from: Date, vault: string): Promise<FailedRun[]> {
  const rows = await getDb()
    .select({ id: agentRun.id, agentId: agentRun.stage, itemId: agentRun.itemId, pbiId: agentRun.pbiId, startedAt: agentRun.startedAt, outcome: agentRun.outcome, error: agentRun.error })
    .from(agentRun)
    .leftJoin(localItem, eq(localItem.id, agentRun.itemId))
    .leftJoin(workItem, eq(workItem.adoId, agentRun.pbiId))
    .where(and(gte(agentRun.startedAt, from), notInArray(agentRun.stage, JOB_STAGES), notInArray(agentRun.outcome, NOT_FAILED_OUTCOMES), runInVault(vault)))
    .orderBy(desc(agentRun.id))
    .limit(FAILURES_READ);

  return rows.map((row) => ({ ...row, startedAt: new Date(row.startedAt) }));
}

// Runs come newest first, so a group's first run is its latest.
function groupFailures(runs: FailedRun[]): FailureGroup[] {
  const groups = new Map<string, FailureGroup>();

  for (const run of runs) {
    const error = run.error ?? run.outcome;
    const key = `${run.agentId}\n${error}`;
    const group = groups.get(key);

    groups.set(key, group ? { ...group, times: group.times + 1 } : { agentId: run.agentId, error, times: 1, latest: run });
  }

  return [...groups.values()];
}
