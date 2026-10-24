import type { ReviewTaskData } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import type { ToolDefinition } from "@agenttools/runtime";
import { checkoutPullRequest, removeCheckout, reviewRepo } from "../codeReview/ReviewWriter";
import { loadPullRequest } from "../codeReview/loadReviewContext";
import { findOutdatedComments } from "../codeReview/outdatedComments";
import { parseUnifiedDiff } from "../codeReview/prDiff";
import { reviewCheckoutsRoot } from "../codeReview/reviewCheckouts";
import type { ReadLog } from "../evidence/ReadLog";
import type { OpenReposOptions } from "../models/OpenReposOptions";
import type { RepoSource } from "../models/RepoSource";
import type { TaskContext } from "../models/TaskContext";
import { numberOption, outsideAccessContext } from "../stage";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterRunContext } from "../toolset/models/WriterRunContext";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { buildBetterReviewMessage } from "./betterReviewMessage";
import { createBetterReviewTools } from "./betterReviewTools";
import { commitBetterReview } from "./commitBetterReview";
import { loadBetterReviewContext } from "./loadBetterReviewContext";
import type { BetterReviewRun } from "./models/BetterReviewRun";
import { chooseScope } from "./reviewScope";

type ItemRow = typeof localItem.$inferSelect;

export const BETTER_REVIEW_INTEGRATION = "reviewPullRequests";
const DEFAULT_MAX_DIFF_LINES = 3000;

// Better Review's tools as a granted writer (stage 2b, 2026-10-23): the PR's PBIs in full, the repo's review rules, the
// other reviewers' threads, research tasks, and a follow-up anchored to the last reviewed commit; the PR is checked out
// as a worktree the repo tools read. The comments, the review's version and the rules are written once the run succeeds.
export class BetterReviewWriter implements RunWriter {
  readonly integration = BETTER_REVIEW_INTEGRATION;

  private readonly run: BetterReviewRun = {
    context: null,
    checkout: null,
    scope: { reviewed: [], skipped: [] },
    mode: { kind: "full", reason: "not prepared" },
    fullPatches: new Map(),
    triggerThreads: null,
    outdatedIds: [],
    repos: { isOn: false, repos: [], commits: {}, tools: [] },
    toolset: null,
    draft: { summary: null, comments: [], updates: [], result: null, reviewerNotes: [], rules: [] },
  };

  constructor(private readonly context: TaskContext) {}

  async repoSources(task: ItemRow): Promise<RepoSource[]> {
    const reviewed = await loadPullRequest(this.context.deps.db, (task.data as ReviewTaskData).prId);

    return [{ vault: reviewed.vault, names: [reviewed.repoName] }];
  }

  repoOptions(_task: ItemRow, runId: number): OpenReposOptions {
    return { toolsRoot: reviewCheckoutsRoot(this.context.deps, runId) };
  }

  tools(log: ReadLog): ToolDefinition<any>[] {
    return createBetterReviewTools(this.run, log);
  }

  // Each step is a traced phase: the PR and what the review reads first, the PR checkout, the scope.
  async contextBlocks(task: ItemRow, run: WriterRunContext): Promise<string[]> {
    const { deps, agent } = this.context;
    const data = task.data as ReviewTaskData & { full?: boolean };
    const reviewed = await loadPullRequest(deps.db, data.prId);

    this.run.triggerThreads = data.trigger === "reviewer-comments" ? data.threads ?? [] : null;
    this.run.repos = run.repos;
    this.run.context = await loadBetterReviewContext(this.context, reviewed, reviewRepo(run.repos, reviewed.repoName), outsideAccessContext(agent.id, run.runId, task));

    const { pr, repo } = this.run.context;

    await run.session.phase("review-context", {
      pbis: this.run.context.pbiTexts.map((pbi) => pbi.adoId),
      rules: this.run.context.rules.rules.filter((rule) => rule.active).map((rule) => rule.id),
      threads: "threads" in this.run.context.otherReviews ? this.run.context.otherReviews.threads.length : this.run.context.otherReviews.unavailable,
      research: this.run.context.research.map((item) => item.taskId),
    });

    this.run.checkout = await checkoutPullRequest(this.context, run.runId, repo, pr);
    await run.session.phase("checkout", { commit: this.run.checkout.sourceCommit, mergeBase: this.run.checkout.mergeBase });

    const prFiles = parseUnifiedDiff(await deps.repoCache.diff(repo, this.run.checkout.mergeBase, this.run.checkout.sourceCommit));
    const choice = await chooseScope(deps.repoCache, repo, this.run.checkout, prFiles, this.run.context.previous?.commit ?? null, numberOption(agent, "maxDiffLines", DEFAULT_MAX_DIFF_LINES), data.full === true);

    this.run.mode = choice.mode;
    this.run.scope = choice.scope;
    this.run.fullPatches = choice.fullPatches;
    this.run.outdatedIds = await findOutdatedComments(deps.repoCache, repo, this.run.context.earlierComments, this.run.checkout.sourceCommit);
    await run.session.phase("diff", { mode: this.run.mode, files: prFiles.length, reviewed: this.run.scope.reviewed.length, skipped: this.run.scope.skipped.length, changedComments: this.run.outdatedIds });

    return [buildBetterReviewMessage(this.run.context, this.run.checkout, this.run.scope, this.run.mode, this.run.outdatedIds, this.run.triggerThreads)];
  }

  // The commit lists the comments and rules as the run's outputs itself, so nothing is returned to list twice.
  async commit(target: WriterTarget): Promise<string[]> {
    if (!this.run.context || !this.run.checkout || !this.run.draft.result) {
      return [];
    }

    await commitBetterReview(target.deps, target.task, this.run, target.runId, target.taskIds);

    return [];
  }

  async cleanUp(): Promise<void> {
    await removeCheckout(this.context, this.run);
  }
}
