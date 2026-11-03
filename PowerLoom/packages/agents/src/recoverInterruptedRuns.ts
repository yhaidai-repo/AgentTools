import { setItemStatus } from "@powerloom/core";
import { agentRun, localItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, isNull, like, notInArray, or } from "drizzle-orm";

const INTERRUPTED = "Interrupted: the agent-runner stopped during the run";
const ACTOR = "agent-runner";

// At startup: runs still `running` belonged to a process that is gone. Fail them visibly and put their tasks back,
// so the dispatcher hands them out again. Returns the released tasks (the caller tells PowerLoom their runs ended).
// A task in `liveTaskIds` (the runner is running it now) keeps its run; at a cold start there is none.
export async function recoverInterruptedRuns(db: PowerLoomDb, liveTaskIds: Iterable<string> = []): Promise<string[]> {
  const live = [...new Set(liveTaskIds)];
  const notLiveRun = live.length === 0 ? undefined : or(isNull(agentRun.itemId), notInArray(agentRun.itemId, live));
  const notLiveTask = live.length === 0 ? undefined : notInArray(localItem.id, live);
  const stale = await db.update(agentRun).set({ outcome: "failed", error: INTERRUPTED, endedAt: new Date() }).where(and(eq(agentRun.outcome, "running"), notLiveRun)).returning({ id: agentRun.id });
  const running = await db.select().from(localItem).where(and(like(localItem.assignee, "agent:%"), eq(localItem.status, "in-progress"), notLiveTask));

  for (const task of running) {
    await db.update(localItem).set({ heldBy: [INTERRUPTED] }).where(eq(localItem.id, task.id));
    await setItemStatus(db, task.id, "in-progress", "open", ACTOR);
  }

  if (stale.length + running.length > 0) {
    console.error(`recovered ${stale.length} interrupted run(s): ${stale.map((run) => run.id).join(", ")}; ${running.length} task(s) back to open`);
  }

  return running.map((task) => task.id);
}
