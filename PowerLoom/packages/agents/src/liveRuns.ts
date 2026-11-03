import { agentRun, type PowerLoomDb } from "@powerloom/db";
import { and, eq, inArray } from "drizzle-orm";
import { stackOwner } from "./devHubTools";

// What the runner is running right now, for the sweeps that clean up what earlier runs left behind: their tasks, and
// the owner names (powerloom-run-<id>) of their open runs' stacks, browser cases, sandboxes and review checkouts.
// A cold start has no live run, so everything found is an orphan, as before.
export interface LiveRuns {
  taskIds: ReadonlySet<string>;
  owners: ReadonlySet<string>;
  runIds: ReadonlySet<number>;
}

export const NO_LIVE_RUNS: LiveRuns = { taskIds: new Set(), owners: new Set(), runIds: new Set() };

export async function liveRunsOf(db: PowerLoomDb, taskIds: Iterable<string>): Promise<LiveRuns> {
  const tasks = new Set(taskIds);

  if (tasks.size === 0) {
    return NO_LIVE_RUNS;
  }

  const open = await db.select({ id: agentRun.id }).from(agentRun).where(and(eq(agentRun.outcome, "running"), inArray(agentRun.itemId, [...tasks])));
  const runIds = new Set(open.map((run) => run.id));

  return { taskIds: tasks, owners: new Set([...runIds].map(stackOwner)), runIds };
}
