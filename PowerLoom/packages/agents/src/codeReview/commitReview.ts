import { agentRun, codeReview, reviewComment, type PowerLoomDb } from "@powerloom/db";
import { eq, inArray, like } from "drizzle-orm";
import type { CommentUpdateDraft } from "./models/CommentUpdateDraft";
import type { NewCommentDraft } from "./models/NewCommentDraft";
import type { ReviewRun } from "./models/ReviewRun";

const UPDATED_STATUS: Record<CommentUpdateDraft["action"], "withdrawn" | "open" | "fixed"> = { withdraw: "withdrawn", keep: "open", refine: "open", fixed: "fixed" };

// A successful run: earlier comments whose code changed are outdated, the agent's decisions on earlier comments apply, its
// new comments are added, and the review records the reviewed commit and summary. Returns the run's outputs.
export async function commitReview(db: PowerLoomDb, run: ReviewRun, runId: number): Promise<string[]> {
  const { pr } = run.context!;
  const checkout = run.checkout!;

  await markOutdated(db, run.outdatedIds);
  await applyUpdates(db, run.draft.updates);

  const added = await insertComments(db, pr.id, checkout.sourceCommit, runId, run.draft.comments);
  // The PR's push count fits the reviewed commit only when the job saw that commit; a push since then shows on the next sync.
  const reviewedIteration = pr.sourceCommit === checkout.sourceCommit ? pr.iteration : null;

  await db.update(codeReview).set({
    reviewedCommit: checkout.sourceCommit,
    reviewedIteration,
    summaryMd: run.draft.summary,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(codeReview.prId, pr.id));

  const outputs = [...added, ...run.draft.updates.map((update) => `${update.id} ${update.action}`), ...run.outdatedIds.map((id) => `${id} outdated`)];

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));

  return outputs;
}

export async function markOutdated(db: PowerLoomDb, ids: string[]): Promise<void> {
  if (ids.length > 0) {
    await db.update(reviewComment).set({ status: "outdated", updatedAt: new Date() }).where(inArray(reviewComment.id, ids));
  }
}

export async function applyUpdates(db: PowerLoomDb, updates: CommentUpdateDraft[]): Promise<void> {
  for (const update of updates) {
    const body = update.action === "refine" && update.body ? { bodyMd: update.body } : {};
    const anchor = update.anchor ? { commit: update.anchor.commit, startLine: update.anchor.startLine, endLine: update.anchor.endLine, codeSnippet: update.anchor.snippet, snippetStartLine: update.anchor.snippetStartLine } : {};

    await db.update(reviewComment).set({ ...body, ...anchor, status: UPDATED_STATUS[update.action], agentReplyMd: update.reply, updatedAt: new Date() }).where(eq(reviewComment.id, update.id));
  }
}

export async function insertComments(db: PowerLoomDb, prId: number, commit: string, runId: number, comments: NewCommentDraft[]): Promise<string[]> {
  const first = await nextCommentNumber(db, prId);
  const rows = comments.map((comment, index) => ({
    id: `RC-${prId}-${String(first + index).padStart(3, "0")}`,
    prId,
    runId,
    commit,
    filePath: comment.path,
    startLine: comment.startLine,
    endLine: comment.endLine,
    severity: comment.severity,
    category: comment.category ?? null,
    bodyMd: comment.body,
    codeSnippet: comment.snippet,
    snippetStartLine: comment.snippetStartLine,
  }));

  if (rows.length > 0) {
    await db.insert(reviewComment).values(rows);
  }

  return rows.map((row) => row.id);
}

// Comment ids are `RC-<prId>-<nnn>`, numbered per PR; never reused.
async function nextCommentNumber(db: PowerLoomDb, prId: number): Promise<number> {
  const stem = `RC-${prId}-`;
  const rows = await db.select({ id: reviewComment.id }).from(reviewComment).where(like(reviewComment.id, `${stem}%`));

  return rows.reduce((max, row) => Math.max(max, Number(row.id.slice(stem.length)) || 0), 0) + 1;
}
