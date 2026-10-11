import { setItemStatus } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import type { AgentDefinition } from "@agenttools/config";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunResult } from "../models/AgentRunResult";
import { numberOption, pauseForRateLimit } from "../stage";

type ItemRow = typeof localItem.$inferSelect;

const ACTOR = "agent-runner";

// After the run: success → done (if the commit didn't close it already); rate limit → back to open and every agent
// paused; any other failure → one more attempt counted, back to open or, after `maxFailures`, blocked.
export async function endTask(deps: AgentDeps, agent: AgentDefinition, task: ItemRow, result: AgentRunResult): Promise<void> {
  const [current] = await deps.db.select({ status: localItem.status }).from(localItem).where(eq(localItem.id, task.id));

  if (current?.status !== "in-progress") {
    return;
  }

  if (result.outcome === "success") {
    await setItemStatus(deps.db, task.id, "in-progress", "done", ACTOR, result.runId);

    return;
  }

  if (result.outcome === "rate-limited") {
    await releaseTask(deps.db, task, "rate limited; agents are paused until the limit resets");
    await pauseForRateLimit(deps, result.rateLimitResetsAt);

    return;
  }

  await countFailure(deps.db, task, numberOption(agent, "maxFailures", 3), result.runId);
}

// The task goes back to the dispatcher without counting an attempt; the reason shows on the PBI page.
export async function releaseTask(db: PowerLoomDb, task: ItemRow, reason: string): Promise<void> {
  await db.update(localItem).set({ heldBy: [reason] }).where(eq(localItem.id, task.id));
  await setItemStatus(db, task.id, "in-progress", "open", ACTOR);
}

// An unexpected error: counted like a failed run, unless the task was already ended.
export async function failAfterError(db: PowerLoomDb, task: ItemRow, maxFailures: number): Promise<void> {
  const [current] = await db.select({ status: localItem.status }).from(localItem).where(eq(localItem.id, task.id));

  if (current?.status === "in-progress") {
    await countFailure(db, task, maxFailures, undefined);
  }
}

async function countFailure(db: PowerLoomDb, task: ItemRow, maxFailures: number, runId: number | undefined): Promise<void> {
  const attempts = task.attempts + 1;

  await db.update(localItem).set({ attempts }).where(eq(localItem.id, task.id));
  await setItemStatus(db, task.id, "in-progress", attempts >= maxFailures ? "blocked" : "open", ACTOR, runId);
}
