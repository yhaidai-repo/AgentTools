"use server";

import { DISPATCH_QUEUE, PULL_REQUESTS_QUEUE, REVIEW_AGENT, answerReviewCommentCommand, closeReview, queueReviewTask, type DispatchJob } from "@adoa/core";
import { pullRequest } from "@adoa/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getBoss } from "@/lib/boss";
import { runWebCommand } from "@/lib/commandContext";
import { getDb } from "@/lib/db";
import { formText } from "@/lib/formFields";
import type { ActionResult } from "@/models/ActionResult";

// The pull-requests job is exclusive: a second click while one is queued or running does nothing.
export async function checkPullRequestsNow(): Promise<ActionResult> {
  const jobId = await (await getBoss()).send(PULL_REQUESTS_QUEUE);

  return { ok: true, message: jobId ? "Checking Azure DevOps; new PRs appear in a few seconds." : "A check is already queued or running." };
}

// The answer feeds the agent's next run on this PR (user decision 2026-10-02). An empty answer takes it back.
export async function answerComment(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const answered = await runWebCommand(answerReviewCommentCommand, { commentId: String(form.get("commentId") ?? ""), answer: formText(form, "answer") });

  if (!answered.ok) {
    return { ok: false, message: answered.error };
  }

  revalidatePath(`/reviews/${answered.value.prId}`);

  return { ok: true, message: answered.value.answered ? "Answer saved; the next review run reads it." : "Answer removed." };
}

// Local only: ADO isn't told (user decision 2026-10-02). Rerun reopens it.
export async function closeReviewAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const prId = Number(form.get("prId"));

  await closeReview(getDb(), prId, formText(form, "reason"), "human");
  revalidatePath(`/reviews/${prId}`);
  revalidatePath("/reviews");

  return { ok: true, message: "Review closed." };
}

// The user starts every review (user decision 2026-10-02): a full review of the PR's current commit, earlier comments and
// answers included. The agent's open tasks start now if it's enabled (same as its schedule or "Run now").
export async function queueReview(prId: number): Promise<ActionResult> {
  const [pr] = await getDb().select({ sourceCommit: pullRequest.sourceCommit, title: pullRequest.title }).from(pullRequest).where(eq(pullRequest.id, prId));

  if (!pr) {
    return { ok: false, message: "Unknown pull request." };
  }

  const queued = await queueReviewTask(getDb(), prId, pr.sourceCommit, pr.title);

  if (!queued.ok) {
    return { ok: false, message: queued.error };
  }

  const job: DispatchJob = { agentId: REVIEW_AGENT };

  await (await getBoss()).send(DISPATCH_QUEUE, job);
  revalidatePath(`/reviews/${prId}`);
  revalidatePath("/reviews");

  return { ok: true, message: `${queued.value} queued; it starts now if the code-review agent is enabled (Agents page).` };
}
