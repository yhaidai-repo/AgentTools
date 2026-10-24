import { setItemStatus } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import type { AgentDefinition } from "@agenttools/config";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunResult } from "../models/AgentRunResult";
import { forgetConversations } from "../resume/forgetConversations";
import { numberOption, pauseForRateLimit } from "../stage";
import { askUserAboutBlockedDraft } from "../techWriter/blockedDraft";

type ItemRow = typeof localItem.$inferSelect;

const ACTOR = "agent-runner";

// After the run: success → done (if the commit didn't close it already); rate limit → back to open and every agent
// paused; budget exceeded → blocked at once, since a retry would cost the same again (user decision 2026-10-13: Re-run
// after raising the budget); any other failure → one more attempt counted, back to open or, after `maxFailures`,
// blocked with its last error as the reason. A blocked draft-merge task also gives the user a task for its draft.
export async function endTask(deps: AgentDeps, agent: AgentDefinition, task: ItemRow, result: AgentRunResult): Promise<void> {
  if (result.outcome === "success") {
    await forgetConversations(deps, agent.model.provider, task.id);
  }

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

  if (result.outcome === "budget-exceeded") {
    const reason = `Budget exceeded: the run cost more than ${agent.budgets.perRunUsd} USD. Raise ${agent.id}'s per-run budget or narrow the task, then Re-run.`;

    await blockTask(deps.db, task, reason, result.runId);
    await askUserAboutBlockedDraft(deps.db, task, reason);

    return;
  }

  const status = await countFailure(deps.db, task, numberOption(agent, "maxFailures", 3), result.runId, result.error ?? "the run failed");

  if (status === "blocked") {
    await askUserAboutBlockedDraft(deps.db, task, result.error ?? "It failed too often.");
  }
}

// The task goes back to the dispatcher without counting an attempt; the reason shows on the PBI page.
export async function releaseTask(db: PowerLoomDb, task: ItemRow, reason: string): Promise<void> {
  await db.update(localItem).set({ heldBy: [reason] }).where(eq(localItem.id, task.id));
  await setItemStatus(db, task.id, "in-progress", "open", ACTOR);
}

// Blocked with the reason on the task's and the PBI's pages; Re-run clears it.
export async function blockTask(db: PowerLoomDb, task: ItemRow, reason: string, runId: number | undefined): Promise<void> {
  await db.update(localItem).set({ heldBy: [reason] }).where(eq(localItem.id, task.id));
  await setItemStatus(db, task.id, "in-progress", "blocked", ACTOR, runId);
}

// An unexpected error (e.g. before the run started, so no run records it): counted like a failed run, unless the task
// was already ended.
export async function failAfterError(db: PowerLoomDb, task: ItemRow, maxFailures: number, error: unknown): Promise<void> {
  const [current] = await db.select({ status: localItem.status }).from(localItem).where(eq(localItem.id, task.id));

  if (current?.status === "in-progress") {
    await countFailure(db, task, maxFailures, undefined, error instanceof Error ? error.message : String(error));
  }
}

// One more attempt: back to open, or blocked with the last error once `maxFailures` is reached (user, 2026-10-21: a
// blocked task says why).
async function countFailure(db: PowerLoomDb, task: ItemRow, maxFailures: number, runId: number | undefined, error: string): Promise<"blocked" | "open"> {
  const attempts = task.attempts + 1;

  await db.update(localItem).set({ attempts }).where(eq(localItem.id, task.id));

  if (attempts < maxFailures) {
    await setItemStatus(db, task.id, "in-progress", "open", ACTOR, runId);

    return "open";
  }

  await blockTask(db, task, `Failed ${attempts} times; the last error: ${error}`, runId);

  return "blocked";
}
