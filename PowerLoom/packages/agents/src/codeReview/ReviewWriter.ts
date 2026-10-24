import type { ReviewTaskData } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import type { PullRequestCheckout, RepoRef, ToolDefinition } from "@agenttools/runtime";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ReadLog } from "../evidence/ReadLog";
import type { OpenReposOptions } from "../models/OpenReposOptions";
import type { RepoAccess } from "../models/RepoAccess";
import type { RepoSource } from "../models/RepoSource";
import type { TaskContext } from "../models/TaskContext";
import { numberOption } from "../stage";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterRunContext } from "../toolset/models/WriterRunContext";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import { createCodeReviewTools } from "./codeReviewTools";
import { commitReview } from "./commitReview";
import { loadPullRequest, loadReviewContext } from "./loadReviewContext";
import type { ReviewRun } from "./models/ReviewRun";
import { findOutdatedComments } from "./outdatedComments";
import { parseUnifiedDiff, selectScope } from "./prDiff";
import { reviewCheckoutsRoot } from "./reviewCheckouts";
import { buildReviewMessage } from "./reviewMessage";

type ItemRow = typeof localItem.$inferSelect;

export const CODE_REVIEW_INTEGRATION = "reviewCode";
const DEFAULT_MAX_DIFF_LINES = 3000;

// Code review's tools as a granted writer (stage 2b, 2026-10-23): the PR checked out as a worktree of the cached repo
// (the repo tools read it), its diff within the agent's size cap, earlier comments whose code changed; the comments and
// the review's version are written once the run succeeds. The worktree is removed whatever happens.
export class ReviewWriter implements RunWriter {
  private readonly run: ReviewRun = { context: null, checkout: null, scope: { reviewed: [], skipped: [] }, outdatedIds: [], repos: noRepoAccess(), toolset: null, draft: { summary: null, comments: [], updates: [] } };

  constructor(private readonly context: TaskContext) {}

  async repoSources(task: ItemRow): Promise<RepoSource[]> {
    const reviewed = await loadPullRequest(this.context.deps.db, (task.data as ReviewTaskData).prId);

    return [{ vault: reviewed.vault, names: [reviewed.repoName] }];
  }

  // The repo tools read the PR's checkout, not the cache; no open_repo there.
  repoOptions(_task: ItemRow, runId: number): OpenReposOptions {
    return { toolsRoot: reviewCheckoutsRoot(this.context.deps, runId) };
  }

  tools(log: ReadLog): ToolDefinition<any>[] {
    return createCodeReviewTools(this.run);
  }

  // Each step is a traced phase: the PR, the PR checkout, the diff, outdated comments.
  async contextBlocks(task: ItemRow, run: WriterRunContext): Promise<string[]> {
    const { deps, agent } = this.context;
    const reviewed = await loadPullRequest(deps.db, (task.data as ReviewTaskData).prId);

    this.run.repos = run.repos;
    this.run.context = await loadReviewContext(deps.db, reviewed, reviewRepo(run.repos, reviewed.repoName));

    const { pr, repo } = this.run.context;

    this.run.checkout = await checkoutPullRequest(this.context, run.runId, repo, pr);
    await run.session.phase("checkout", { commit: this.run.checkout.sourceCommit, mergeBase: this.run.checkout.mergeBase });

    const files = parseUnifiedDiff(await deps.repoCache.diff(repo, this.run.checkout.mergeBase, this.run.checkout.sourceCommit));

    this.run.scope = selectScope(files, numberOption(agent, "maxDiffLines", DEFAULT_MAX_DIFF_LINES));
    this.run.outdatedIds = await findOutdatedComments(deps.repoCache, repo, this.run.context.earlierComments, this.run.checkout.sourceCommit);
    await run.session.phase("diff", { files: files.length, reviewed: this.run.scope.reviewed.length, skipped: this.run.scope.skipped.length, outdated: this.run.outdatedIds });

    return [buildReviewMessage(this.run.context, this.run.checkout, this.run.scope, this.run.outdatedIds)];
  }

  // The commit lists the comments as the run's outputs itself, so nothing is returned to list twice.
  async commit(target: WriterTarget): Promise<string[]> {
    if (!this.run.context || !this.run.checkout) {
      return [];
    }

    await commitReview(target.deps.db, this.run, target.runId);

    return [];
  }

  async cleanUp(): Promise<void> {
    await removeCheckout(this.context, this.run);
  }
}

export async function checkoutPullRequest(context: TaskContext, runId: number, repo: RepoRef, pr: { id: number; sourceRef: string; targetRef: string }): Promise<PullRequestCheckout> {
  return context.deps.repoCache.checkoutPullRequest(repo, { id: pr.id, sourceRef: pr.sourceRef, targetRef: pr.targetRef }, join(reviewCheckoutsRoot(context.deps, runId), repo.name));
}

export async function removeCheckout(context: TaskContext, run: Pick<ReviewRun, "checkout" | "context">): Promise<void> {
  if (!run.checkout || !run.context) {
    return;
  }

  await context.deps.repoCache.removeCheckout(run.context.repo, run.checkout.path);
  await rm(dirname(run.checkout.path), { recursive: true, force: true });
}

// A review reads the PR's repo, so it needs Read repositories on and the repo enabled (user decision 2026-10-13).
export function reviewRepo(repos: RepoAccess, repoName: string): RepoRef {
  if (!repos.isOn) {
    throw new Error("a review reads the PR's repo: switch on Read repositories in this agent's Config");
  }

  if (repos.repos.length === 0) {
    throw new Error(`repo "${repoName}" is disabled in Settings or not in the vault's catalog; its PRs get no review`);
  }

  return repos.repos[0];
}

function noRepoAccess(): RepoAccess {
  return { isOn: false, repos: [], commits: {}, tools: [] };
}
