import { localItem } from "@powerloom/db";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import type { SystemStatus } from "./systemStatus";

type RunInProgress = SystemStatus["runs"][number];

// The runs PowerLoom reports in progress whose task belongs to the vault (user decision 2026-10-18: the dashboard shows
// the selected vault); a run's task id is its local item's.
export async function vaultRunsInProgress(runs: RunInProgress[], vault: string): Promise<RunInProgress[]> {
  if (runs.length === 0) {
    return [];
  }

  const rows = await getDb()
    .select({ id: localItem.id })
    .from(localItem)
    .where(and(inArray(localItem.id, runs.map((run) => run.taskId)), eq(localItem.vault, vault)));
  const vaultTasks = new Set(rows.map((row) => row.id));

  return runs.filter((run) => vaultTasks.has(run.taskId));
}
