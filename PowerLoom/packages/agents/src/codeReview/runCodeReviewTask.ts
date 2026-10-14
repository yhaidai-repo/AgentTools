import type { ReviewTaskData } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import type { RepoRef } from "@agenttools/runtime";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AgentRunSession } from "../AgentRunSession";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { RepoAccess } from "../models/RepoAccess";
import type { TaskContext } from "../models/TaskContext";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { numberOption, skillsTrace } from "../stage";
import { AgentToolset } from "../toolset/AgentToolset";
import { toolsPromptSection } from "../toolset/toolsPromptSection";
import { createCodeReviewTools } from "./codeReviewTools";
import { commitReview } from "./commitReview";
import { loadPullRequest, loadReviewContext } from "./loadReviewContext";
import type { ReviewRun } from "./models/ReviewRun";
import { findOutdatedComments } from "./outdatedComments";
import { parseUnifiedDiff, selectScope } from "./prDiff";
import { buildReviewMessage } from "./reviewMessage";
import { reviewCheckoutsRoot } from "./reviewCheckouts";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "code-review";
const DEFAULT_MAX_DIFF_LINES = 3000;

// One code-review task (CR-…): one run that reviews one pull request at its current commit (user decision 2026-10-02).
// The PR is checked out as a worktree of the cached repo; the worktree is removed and the repo released whatever happens.
export async function runCodeReviewTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const info: AgentRunInfo = {
    stage: "code-review",
    pbiId: null,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: ReviewRun = { context: null, checkout: null, scope: { reviewed: [], skipped: [] }, outdatedIds: [], repos: noRepos(), toolset: null, draft: { summary: null, comments: [], updates: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      await commitReview(deps.db, run, session.runId);
      await run.toolset?.commit(session.runId);
    };

    return await session.finish(ran, commit);
  } finally {
    await cleanUp(deps, run);
  }
}

// Each step is a traced phase: the PR, the repo (clone / refresh / reuse), the PR checkout, the diff, outdated comments.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: ReviewRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const data = task.data as ReviewTaskData;

  await session.phase("context", { task: task.id, pr: data.prId, skills: skillsTrace(skills) });

  const reviewed = await loadPullRequest(deps.db, data.prId);

  run.repos = await openRepos(context, session, [{ vault: reviewed.vault, names: [reviewed.repoName] }], { toolsRoot: reviewCheckoutsRoot(deps, session.runId) });
  run.context = await loadReviewContext(deps.db, reviewed, reviewRepo(run.repos, reviewed.repoName));

  const { pr, repo } = run.context;

  run.checkout = await deps.repoCache.checkoutPullRequest(repo, { id: pr.id, sourceRef: pr.sourceRef, targetRef: pr.targetRef }, join(reviewCheckoutsRoot(deps, session.runId), repo.name));
  await session.phase("checkout", { commit: run.checkout.sourceCommit, mergeBase: run.checkout.mergeBase });

  const files = parseUnifiedDiff(await deps.repoCache.diff(repo, run.checkout.mergeBase, run.checkout.sourceCommit));

  run.scope = selectScope(files, numberOption(agent, "maxDiffLines", DEFAULT_MAX_DIFF_LINES));
  run.outdatedIds = await findOutdatedComments(deps.repoCache, repo, run.context.earlierComments, run.checkout.sourceCommit);
  await session.phase("diff", { files: files.length, reviewed: run.scope.reviewed.length, skipped: run.scope.skipped.length, outdated: run.outdatedIds });

  const toolset = await AgentToolset.open(context, session, task, { repos: run.repos });
  const firstMessage = buildReviewMessage(run.context, run.checkout, run.scope, run.outdatedIds);
  const tools = [...toolset.tools(firstMessage), ...createCodeReviewTools(run)];

  run.toolset = toolset;
  await session.phase("first-message", { chars: firstMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection, toolsPromptSection(tools)].filter(Boolean).join("\n\n"),
    firstMessage,
    tools,
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    observe: (event) => toolset.observe(event),
    hasRequiredOutput: () => run.draft.summary !== null,
  };
}

async function cleanUp(deps: AgentDeps, run: ReviewRun): Promise<void> {
  try {
    if (run.checkout && run.context) {
      await deps.repoCache.removeCheckout(run.context.repo, run.checkout.path);
      await rm(dirname(run.checkout.path), { recursive: true, force: true });
    }
  } finally {
    closeRepos(deps, run.repos);
  }
}

// Code review reads the PR's repo, so it needs Read repositories on and the repo enabled (user decision 2026-10-13).
function reviewRepo(repos: RepoAccess, repoName: string): RepoRef {
  if (!repos.isOn) {
    throw new Error("code review reads the PR's repo: switch on Read repositories in this agent's Config");
  }

  if (repos.repos.length === 0) {
    throw new Error(`repo "${repoName}" is disabled in Settings or not in the vault's catalog; its PRs get no review`);
  }

  return repos.repos[0];
}
