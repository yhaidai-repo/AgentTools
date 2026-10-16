import { setItemStatus } from "@powerloom/core";
import { agentRun, codeReview, type localItem } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { applyUpdates, insertComments, markOutdated } from "../codeReview/commitReview";
import type { AgentDeps } from "../models/AgentDeps";
import { addRunOutputs } from "../tasks/runOutputs";
import type { AgentToolset } from "../toolset/AgentToolset";
import type { BetterReviewRun } from "./models/BetterReviewRun";
import type { ReviewerNote } from "./models/ReviewerNote";
import { renderSummary } from "./renderSummary";
import { appendReviewRules } from "./reviewRules";

type ItemRow = typeof localItem.$inferSelect;

const ACTOR = "agent:better-review";
const DETAILS_VERSION = 1;
const NEW_COMMENT = /^new:(\d+)$/;

// A successful run: the agent's decisions on earlier comments apply (fixed, kept and moved, refined, withdrawn), earlier
// comments whose code changed and that it didn't decide on are outdated, its new comments are added, the research tasks
// it created are written, and the review records the reviewed commit (the next follow-up's anchor), the summary and the
// details. New rules go to the repo's review-rules note last, so a failed commit leaves the vault alone. The task closes
// here, so a run its budget stopped after the summary keeps its review.
export async function commitBetterReview(deps: AgentDeps, task: ItemRow, run: BetterReviewRun, runId: number, toolset: AgentToolset): Promise<string[]> {
  const { pr } = run.context!;
  const checkout = run.checkout!;
  const result = run.draft.result!;
  const decided = new Set(run.draft.updates.map((update) => update.id));
  const outdated = run.outdatedIds.filter((id) => !decided.has(id));

  await markOutdated(deps.db, outdated);
  await applyUpdates(deps.db, run.draft.updates);

  const added = await insertComments(deps.db, pr.id, checkout.sourceCommit, runId, run.draft.comments);
  const notes = run.draft.reviewerNotes.map((note) => withCommentId(note, added));
  const reviewedIteration = pr.sourceCommit === checkout.sourceCommit ? pr.iteration : null;
  const outputs = [...added, ...run.draft.updates.map((update) => `${update.id} ${update.action}`), ...outdated.map((id) => `${id} outdated`)];

  await deps.db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));

  const { taskIds } = await toolset.commit(runId);
  const rules = await saveRules(deps, run, runId);
  const details = {
    version: DETAILS_VERSION,
    agent: "better-review",
    commit: checkout.sourceCommit,
    mode: run.mode,
    result,
    reviewerNotes: notes,
    rules: run.draft.rules.map((rule, index) => ({ ...rule, id: rules.ids[index] ?? null })),
    rulesPath: run.context!.rules.path,
    rulesSaved: rules.saved,
    researchTaskIds: taskIds,
  };

  await deps.db.update(codeReview).set({
    reviewedCommit: checkout.sourceCommit,
    reviewedIteration,
    summaryMd: renderSummary(result, notes),
    details,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(codeReview.prId, pr.id));

  await addRunOutputs(deps.db, runId, rules.ids);
  await setItemStatus(deps.db, task.id, "in-progress", "done", ACTOR, runId);

  return [...outputs, ...taskIds, ...rules.ids];
}

// A `new:<n>` the agent named as covering a reviewer's point becomes the id that comment got.
function withCommentId(note: ReviewerNote, added: string[]): ReviewerNote {
  const created = note.coveredBy ? NEW_COMMENT.exec(note.coveredBy) : null;

  return created ? { ...note, coveredBy: added[Number(created[1]) - 1] ?? note.coveredBy } : note;
}

// Appended to `review-rules/<repo>.md` with the next free ids; where the runner can't write the vault they stay in the
// review's details only, and the review page says so.
async function saveRules(deps: AgentDeps, run: BetterReviewRun, runId: number): Promise<{ ids: string[]; saved: boolean }> {
  const { rules, repo } = run.context!;

  if (run.draft.rules.length === 0 || !deps.docsVault) {
    return { ids: [], saved: run.draft.rules.length === 0 };
  }

  const current = await deps.docsVault.readNote(rules.path);
  const sourced = run.draft.rules.map((rule) => ({ ...rule, source: `${rule.source} (RUN-${runId})` }));
  const appended = appendReviewRules(current, repo.name, sourced, new Date().toISOString().slice(0, 10));

  await deps.docsVault.writeNote(rules.path, appended.text);

  return { ids: appended.ids, saved: true };
}
