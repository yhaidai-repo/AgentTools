import { codeReview, type localItem } from "@powerloom/db";
import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { applyUpdates, insertComments, markOutdated, recordReviewVersion } from "../codeReview/commitReview";
import { recordLocalRepoHead } from "../codeReview/localRepoHead";
import type { AgentDeps } from "../models/AgentDeps";
import { addRunOutputs } from "../tasks/runOutputs";
import type { BetterReviewRun } from "./models/BetterReviewRun";
import type { ReviewerNote } from "./models/ReviewerNote";
import { renderSummary } from "./renderSummary";
import { appendReviewRules } from "./reviewRules";
import { commentKeys, lastCommentIds, reviewerNotesWithCarried } from "./threadsSeen";
import { commentGate, publishReview, unresolvedComments } from "../codeReview/reviewPublication";

type ItemRow = typeof localItem.$inferSelect;

const DETAILS_VERSION = 1;
const NEW_COMMENT = /^new:(\d+)$/;

// A successful run: the agent's decisions on earlier comments apply (fixed, kept and moved, refined, withdrawn), earlier
// comments whose code changed and that it didn't decide on are outdated, its new comments are added, the research tasks
// it created are written, and the review records the reviewed commit (the next follow-up's anchor), the summary, the
// details (the threads' verdicts, carried ones included, and the newest comment it saw in each) and the comments it saw,
// so the PR sync doesn't queue a follow-up for them; the commit, summary and details are also this run's version.
// Published rules carry stable identities: a later failure can be retried without appending them again.
export async function commitBetterReview(deps: AgentDeps, task: ItemRow, run: BetterReviewRun, runId: number, taskIds: string[]): Promise<string[]> {
  return publishReview(deps.db, run.context!.pr.id, db => commitLockedBetterReview({ ...deps, db }, task, run, runId, taskIds));
}

async function commitLockedBetterReview(deps: AgentDeps, task: ItemRow, run: BetterReviewRun, runId: number, taskIds: string[]): Promise<string[]> {
  const checkout = run.checkout!;
  const pr = await recordLocalRepoHead(deps.db, run.context!.pr, checkout.sourceCommit);
  const decided = new Set(run.draft.updates.map((update) => update.id));
  const outdated = run.outdatedIds.filter((id) => !decided.has(id));

  await markOutdated(deps.db, outdated);
  await applyUpdates(deps.db, run.draft.updates);

  const added = await insertComments(deps.db, pr.id, checkout.sourceCommit, runId, run.draft.comments);
  const unresolved = await unresolvedComments(deps.db, pr.id);
  const result = unresolved && run.draft.result!.verdict === "ready"
    ? { ...run.draft.result!, verdict: "not_ready" as const, assessment: `${commentGate(unresolved)} ${run.draft.result!.assessment}` }
    : run.draft.result!;
  const notes = reviewerNotesWithCarried(run.context!, run.draft.reviewerNotes.map((note) => withCommentId(note, added)));
  const threads = "threads" in run.context!.otherReviews ? run.context!.otherReviews.threads : null;
  const reviewedIteration = pr.sourceCommit === checkout.sourceCommit ? pr.iteration : null;
  const outputs = [...added, ...run.draft.updates.map((update) => `${update.id} ${update.action}`), ...outdated.map((id) => `${id} outdated`)];

  await addRunOutputs(deps.db, runId, outputs);

  const rules = await saveRules(deps, run, runId, task.id);
  const details = {
    version: DETAILS_VERSION,
    agent: "better-review",
    commit: checkout.sourceCommit,
    mode: run.mode,
    result,
    reviewerNotes: notes,
    threadsSeen: threads ? lastCommentIds(threads) : run.context!.previous?.threadsSeen ?? {},
    rules: run.draft.rules.map((rule, index) => ({ ...rule, id: rules.ids[index] ?? null })),
    rulesPath: run.context!.rules.path,
    rulesSaved: rules.saved,
    researchTaskIds: taskIds,
  };
  const summaryMd = renderSummary(result, notes);

  await deps.db.update(codeReview).set({
    reviewedCommit: checkout.sourceCommit,
    reviewedIteration,
    summaryMd,
    details,
    ...(unresolved ? { status: "active" as const, closedReason: null } : {}),
    ...(threads ? { seenComments: sql`(select coalesce(jsonb_agg(distinct key), '[]'::jsonb) from jsonb_array_elements_text(coalesce(${codeReview.seenComments}, '[]'::jsonb) || ${JSON.stringify(commentKeys(threads))}::jsonb) as key)` } : {}),
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(codeReview.prId, pr.id));
  await recordReviewVersion(deps.db, { prId: pr.id, runId, reviewedCommit: checkout.sourceCommit, reviewedIteration, summaryMd, details });

  await addRunOutputs(deps.db, runId, rules.ids);

  return [...outputs, ...taskIds, ...rules.ids];
}

// A `new:<n>` the agent named as covering a reviewer's point becomes the id that comment got.
function withCommentId(note: ReviewerNote, added: string[]): ReviewerNote {
  const created = note.coveredBy ? NEW_COMMENT.exec(note.coveredBy) : null;

  return created ? { ...note, coveredBy: added[Number(created[1]) - 1] ?? note.coveredBy } : note;
}

// Appended to `review-rules/<repo>.md` with the next free ids; where the runner can't write the vault they stay in the
// review's details only, and the review page says so.
export async function saveRules(deps: AgentDeps, run: BetterReviewRun, runId: number, taskId: string): Promise<{ ids: string[]; saved: boolean }> {
  const { rules, repo } = run.context!;

  if (run.draft.rules.length === 0 || !deps.docsVault) {
    return { ids: [], saved: run.draft.rules.length === 0 };
  }

  const writer = deps.docsVault;
  if (!writer.appendNote) throw new Error("review rule publication requires append-only note access");
  // All application publishers serialize ID allocation; append-only I/O preserves concurrent note edits.
  return deps.db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${deps.docsVaultName}:${rules.path}`}, 0))`);
    const current = await writer.readNote(rules.path);
    const identities = run.draft.rules.map(rule => createHash("sha256").update(JSON.stringify([taskId, rule])).digest("hex"));
    const sourced = run.draft.rules.map(rule => ({ ...rule, source: `${rule.source} (RUN-${runId})` }));
    const appended = appendReviewRules(current, repo.name, sourced, new Date().toISOString().slice(0, 10), identities);
    if (appended.suffix) await writer.appendNote!(rules.path, appended.suffix);
    return { ids: appended.ids, saved: true };
  });
}
