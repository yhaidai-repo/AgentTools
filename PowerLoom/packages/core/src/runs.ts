import { agentRun, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { RunOutcome } from "./models/RunOutcome";
import type { Stage } from "./models/Stage";

// Stages the worker's own jobs record as runs (the ADO sync, the pull request check): no agent's, so agent run lists and
// counts leave them out.
export const JOB_STAGES: Stage[] = ["sync", "pull-requests"];


// Outcomes that aren't failures. A budget stop is the budget doing its job (user decision 2026-10-13): every statistic
// counts it apart from the failures.
export const NOT_FAILED_OUTCOMES: RunOutcome[] = ["success", "no-op", "running", "budget-exceeded"];

export function isFailedOutcome(outcome: string): boolean {
  return !NOT_FAILED_OUTCOMES.includes(outcome as RunOutcome);
}

export async function startRun(db: PowerLoomDb, stage: Stage): Promise<number> {
  const [row] = await db.insert(agentRun).values({ stage }).returning({ id: agentRun.id });

  return row.id;
}

export async function finishRun(db: PowerLoomDb, runId: number, outcome: RunOutcome, error: string | null): Promise<void> {
  await db.update(agentRun).set({ outcome, error, endedAt: new Date() }).where(eq(agentRun.id, runId));
}
