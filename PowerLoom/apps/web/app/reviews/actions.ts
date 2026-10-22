"use server";

import { answerReviewCommentCommand, deleteReviewCommand, isAdoActive, readAdoSettings } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { requireVault } from "@/lib/currentVault";
import { runWebCommand } from "@/lib/commandContext";
import { getDb } from "@/lib/db";
import { formText } from "@/lib/formFields";
import { getAgentConfig } from "@/lib/agentConfig";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";

// The task type review agents take (an agent's `handles`).
const REVIEW_TASK_TYPE = "review";

// PowerLoom checks the vault's pull requests; one vault's checks run one after the other.
export async function checkPullRequestsNow(): Promise<ActionResult> {
  const vault = await requireVault();

  if (!isAdoActive(await readAdoSettings(getDb(), vault))) {
    return { ok: false, message: `The Azure DevOps integration of ${vault} is off or incomplete: see Settings.` };
  }

  return powerloomResult(await powerloom.POST("/api/ado/pull-requests/sync", { body: { vault } }), "Checking Azure DevOps; new PRs appear in a few seconds.");
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
  const result = powerloomResult(await powerloom.POST("/api/reviews/close", { body: { prIds: [prId], reason: formText(form, "reason") } }), "Review closed.");

  revalidatePath(`/reviews/${prId}`);
  revalidatePath("/reviews");

  return result;
}

// The grid's bulk actions (user decision 2026-10-06): each selected review in turn; refusals are reported together.
export async function queueSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return forSelected(form, "queued", queueReview);
}

// Add review (user decision 2026-10-21): the active PR of the branch, or a branch review without one.
export async function addReview(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const vault = await requireVault();
  const body = { vault, repo: formText(form, "repo") ?? "", branch: formText(form, "branch") ?? "", targetBranch: formText(form, "targetBranch") || null, pbi: formText(form, "pbi") || null };
  const added = await powerloom.POST("/api/reviews", { body });

  revalidatePath("/reviews");

  return powerloomResult(added, added.data?.message ?? "Review added.");
}

export async function closeSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return forSelected(form, "closed", closeReview);
}

export async function deleteSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return forSelected(form, "deleted", deleteReview);
}

async function forSelected(form: FormData, done: string, act: (prId: number) => Promise<ActionResult>): Promise<ActionResult> {
  const ids = form.getAll("prId").map(Number).filter(Number.isInteger);

  if (ids.length === 0) {
    return { ok: false, message: "Select at least one review." };
  }

  const results = await Promise.all(ids.map(act));
  const problems = results.filter((result) => !result.ok).map((result) => result.message);

  return { ok: problems.length === 0, message: `${ids.length - problems.length} review(s) ${done}.${problems.length > 0 ? ` ${problems.join(" ")}` : ""}` };
}

// The review page's Close (no reason) and Delete (user decision 2026-10-06: the same actions on the grid and the review page).
export async function closeReview(prId: number): Promise<ActionResult> {
  const result = powerloomResult(await powerloom.POST("/api/reviews/close", { body: { prIds: [prId], reason: null } }), "Review closed.");

  revalidatePath("/reviews");

  return result;
}

export async function deleteReview(prId: number): Promise<ActionResult> {
  const deleted = await runWebCommand(deleteReviewCommand, { prId });

  revalidatePath("/reviews");

  return deleted.ok ? { ok: true, message: `Review of PR ${prId} deleted.` } : { ok: false, message: deleted.error };
}

// The user starts every review (user decision 2026-10-02): a full review of the PR's current commit, earlier comments and
// answers included. The task goes to the pool; every enabled agent taking review tasks is started now (same as its
// schedule or "Run now"), and one of them claims it.
export async function queueReview(prId: number): Promise<ActionResult> {
  const queued = await powerloom.POST("/api/reviews/queue", { body: { prIds: [prId] } });

  if (!queued.response.ok || !queued.data) {
    return powerloomResult(queued, "");
  }

  if (queued.data.refused.length > 0) {
    return { ok: false, message: queued.data.refused[0] };
  }

  const reviewers = (await getAgentConfig().list()).filter((agent) => agent.enabled && agent.handles.includes(REVIEW_TASK_TYPE));

  for (const agent of reviewers) {
    await powerloom.POST("/api/agents/{agentId}/run", { params: { path: { agentId: agent.id } } });
  }

  revalidatePath(`/reviews/${prId}`);
  revalidatePath("/reviews");

  return { ok: true, message: `${queued.data.done[0].value} queued; ${reviewers.length > 0 ? "it starts now" : "no enabled agent takes review tasks yet (Agents page)"}.` };
}
