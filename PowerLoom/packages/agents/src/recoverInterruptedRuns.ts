import { setItemStatus } from "@powerloom/core";
import { agentRun, localItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, like } from "drizzle-orm";

const INTERRUPTED = "Interrupted: the agent-runner stopped during the run";
const ACTOR = "agent-runner";

// At startup: runs still `running` belonged to a process that is gone. Fail them visibly and put their tasks back,
// so the dispatcher hands them out again. Returns the released tasks (the caller tells PowerLoom their runs ended).
export async function recoverInterruptedRuns(db: PowerLoomDb): Promise<string[]> {
  const stale = await db.update(agentRun).set({ outcome: "failed", error: INTERRUPTED, endedAt: new Date() }).where(eq(agentRun.outcome, "running")).returning({ id: agentRun.id });
  const running = await db.select().from(localItem).where(and(like(localItem.assignee, "agent:%"), eq(localItem.status, "in-progress")));

  for (const task of running) {
    await db.update(localItem).set({ heldBy: [INTERRUPTED] }).where(eq(localItem.id, task.id));
    await setItemStatus(db, task.id, "in-progress", "open", ACTOR);
  }

  if (stale.length + running.length > 0) {
    console.error(`recovered ${stale.length} interrupted run(s): ${stale.map((run) => run.id).join(", ")}; ${running.length} task(s) back to open`);
  }

  return running.map((task) => task.id);
}
