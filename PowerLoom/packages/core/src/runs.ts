import { agentRun, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { RunOutcome } from "./models/RunOutcome";
import type { Stage } from "./models/Stage";

// Stages the worker's own jobs record as runs (the ADO sync, the pull request check): no agent's, so agent run lists and
// counts leave them out.
export const JOB_STAGES: Stage[] = ["sync", "pull-requests"];


// A run the user stopped in PowerLoom: the run's abort signal, which only the user's stop and the budget fire, ends it
// as aborted (the budget's as budget-exceeded); a runner that died marks its runs failed.
export const USER_STOP_OUTCOME: RunOutcome = "aborted";

// Runs stopped before they finished, without failing. A budget stop is the budget doing its job (user decision
// 2026-10-13) and a run the user stopped ended as asked (user decision 2026-10-29: a cancel by the user isn't a failed
// run): every statistic counts both apart from the failures.
export const STOPPED_OUTCOMES: RunOutcome[] = ["budget-exceeded", USER_STOP_OUTCOME];

// Outcomes that aren't failures.
export const NOT_FAILED_OUTCOMES: RunOutcome[] = ["success", "no-op", "running", ...STOPPED_OUTCOMES];

export function isFailedOutcome(outcome: string): boolean {
  return !NOT_FAILED_OUTCOMES.includes(outcome as RunOutcome);
}

export function isStoppedOutcome(outcome: string): boolean {
  return STOPPED_OUTCOMES.includes(outcome as RunOutcome);
}

export async function startRun(db: PowerLoomDb, stage: Stage): Promise<number> {
  const [row] = await db.insert(agentRun).values({ stage }).returning({ id: agentRun.id });

  return row.id;
}

export async function finishRun(db: PowerLoomDb, runId: number, outcome: RunOutcome, error: string | null): Promise<void> {
  await db.update(agentRun).set({ outcome, error, endedAt: new Date() }).where(eq(agentRun.id, runId));
}
