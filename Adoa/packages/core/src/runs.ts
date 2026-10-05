import { agentRun, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
import type { RunOutcome } from "./models/RunOutcome";
import type { Stage } from "./models/Stage";

// Stages the worker's own jobs record as runs (the ADO sync, the pull request check): no agent's, so agent run lists and
// counts leave them out.
export const JOB_STAGES: Stage[] = ["sync", "pull-requests"];

export async function startRun(db: AdoaDb, stage: Stage): Promise<number> {
  const [row] = await db.insert(agentRun).values({ stage }).returning({ id: agentRun.id });

  return row.id;
}

export async function finishRun(db: AdoaDb, runId: number, outcome: RunOutcome, error: string | null): Promise<void> {
  await db.update(agentRun).set({ outcome, error, endedAt: new Date() }).where(eq(agentRun.id, runId));
}
