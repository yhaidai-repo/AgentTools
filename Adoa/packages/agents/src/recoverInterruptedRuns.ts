import { setItemStatus, setPbiStatus } from "@adoa/core";
import { agentRun, localItem, workItem, type AdoaDb } from "@adoa/db";
import { and, eq } from "drizzle-orm";
import { moveResearchedPbi } from "./research/commitResearch";

const INTERRUPTED = "Interrupted: the agent-runner stopped during the run";
const ACTOR = "agent-runner";

// At startup: runs still `running` belonged to a process that is gone. Fail them visibly and put their work back.
export async function recoverInterruptedRuns(db: AdoaDb): Promise<number> {
  const stale = await db.update(agentRun).set({ outcome: "failed", error: INTERRUPTED, endedAt: new Date() }).where(eq(agentRun.outcome, "running")).returning({ id: agentRun.id });
  const refining = await db.select({ adoId: workItem.adoId }).from(workItem).where(eq(workItem.pipelineStatus, "refining"));
  const researching = await db.select().from(localItem).where(and(eq(localItem.kind, "research"), eq(localItem.status, "in-progress")));

  for (const pbi of refining) {
    await setPbiStatus(db, pbi.adoId, "refining", "ready-for-refinement", ACTOR);
  }

  for (const task of researching) {
    await setItemStatus(db, task.id, "in-progress", "open", ACTOR);
    await moveResearchedPbi(db, task.pbiId);
  }

  if (stale.length + refining.length + researching.length > 0) {
    console.error(`recovered ${stale.length} interrupted run(s): ${stale.map((run) => run.id).join(", ")}; ${refining.length} PBI(s) and ${researching.length} task(s) back in the queue`);
  }

  return stale.length;
}
