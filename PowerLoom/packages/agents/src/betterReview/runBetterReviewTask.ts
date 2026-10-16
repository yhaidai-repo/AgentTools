import type { ReviewTaskData } from "@powerloom/core";
import type { localItem } from "@powerloom/db";
import type { RepoRef } from "@agenttools/runtime";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AgentRunSession } from "../AgentRunSession";
import { withBudgetNotes } from "../budget/budgetNotes";
import { loadPullRequest } from "../codeReview/loadReviewContext";
import { findOutdatedComments } from "../codeReview/outdatedComments";
import { parseUnifiedDiff } from "../codeReview/prDiff";
import { reviewCheckoutsRoot } from "../codeReview/reviewCheckouts";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { RepoAccess } from "../models/RepoAccess";
import type { TaskContext } from "../models/TaskContext";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { numberOption, outsideAccessContext, skillsTrace } from "../stage";
import { AgentToolset } from "../toolset/AgentToolset";
import { toolsPromptSection } from "../toolset/toolsPromptSection";
import { buildBetterReviewMessage } from "./betterReviewMessage";
import { SUMMARY_TOOL, createBetterReviewTools } from "./betterReviewTools";
import { commitBetterReview } from "./commitBetterReview";
import { loadBetterReviewContext } from "./loadBetterReviewContext";
import type { BetterReviewRun } from "./models/BetterReviewRun";
import { chooseScope } from "./reviewScope";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "better-review";
const DEFAULT_MAX_DIFF_LINES = 3000;

// One review task (CR-…) run by Better Review (user decision 2026-10-16: a new agent beside Code review, taking the
// same review tasks): the PR's PBIs in full, the repo's review rules, the other reviewers' threads, research tasks, and a
// follow-up anchored to the last reviewed commit. The worktree is removed and the repo released whatever happens.
export async function runBetterReviewTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const info: AgentRunInfo = {
    stage: "better-review",
    pbiId: null,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: BetterReviewRun = {
    context: null,
    checkout: null,
    scope: { reviewed: [], skipped: [] },
    mode: { kind: "full", reason: "not prepared" },
    fullPatches: new Map(),
    triggerThreads: null,
    outdatedIds: [],
    repos: noRepos(),
    toolset: null,
    draft: { summary: null, comments: [], updates: [], result: null, reviewerNotes: [], rules: [] },
  };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      await commitBetterReview(deps, task, run, session.runId, run.toolset!);
    };

    return await session.finish(ran, run.toolset ? commit : null, run.draft.result !== null);
  } finally {
    await cleanUp(deps, run);
  }
}

// Each step is a traced phase: the PR and what the review reads first, the repo, the PR checkout, the scope.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: BetterReviewRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const data = task.data as ReviewTaskData & { full?: boolean };

  run.triggerThreads = data.trigger === "reviewer-comments" ? data.threads ?? [] : null;

  await session.phase("context", { task: task.id, pr: data.prId, trigger: data.trigger ?? "user", skills: skillsTrace(skills) });

  const reviewed = await loadPullRequest(deps.db, data.prId);

  run.repos = await openRepos(context, session, [{ vault: reviewed.vault, names: [reviewed.repoName] }], { toolsRoot: reviewCheckoutsRoot(deps, session.runId) });
  run.context = await loadBetterReviewContext(context, reviewed, reviewRepo(run.repos, reviewed.repoName), outsideAccessContext(agent.id, session.runId, task));

  const { pr, repo } = run.context;

  await session.phase("review-context", {
    pbis: run.context.pbiTexts.map((pbi) => pbi.adoId),
    rules: run.context.rules.rules.filter((rule) => rule.active).map((rule) => rule.id),
    threads: "threads" in run.context.otherReviews ? run.context.otherReviews.threads.length : run.context.otherReviews.unavailable,
    research: run.context.research.map((item) => item.taskId),
  });

  run.checkout = await deps.repoCache.checkoutPullRequest(repo, { id: pr.id, sourceRef: pr.sourceRef, targetRef: pr.targetRef }, join(reviewCheckoutsRoot(deps, session.runId), repo.name));
  await session.phase("checkout", { commit: run.checkout.sourceCommit, mergeBase: run.checkout.mergeBase });

  const prFiles = parseUnifiedDiff(await deps.repoCache.diff(repo, run.checkout.mergeBase, run.checkout.sourceCommit));
  const choice = await chooseScope(deps.repoCache, repo, run.checkout, prFiles, run.context.previous?.commit ?? null, numberOption(agent, "maxDiffLines", DEFAULT_MAX_DIFF_LINES), data.full === true);

  run.mode = choice.mode;
  run.scope = choice.scope;
  run.fullPatches = choice.fullPatches;
  run.outdatedIds = await findOutdatedComments(deps.repoCache, repo, run.context.earlierComments, run.checkout.sourceCommit);
  await session.phase("diff", { mode: run.mode, files: prFiles.length, reviewed: run.scope.reviewed.length, skipped: run.scope.skipped.length, changedComments: run.outdatedIds });

  const toolset = await AgentToolset.open(context, session, task, { repos: run.repos, createTask: true });
  const firstMessage = buildBetterReviewMessage(run.context, run.checkout, run.scope, run.mode, run.outdatedIds, run.triggerThreads);
  const tools = withBudgetNotes([...toolset.tools(firstMessage), ...createBetterReviewTools(run, toolset.readLog)], () => session.spentUsd, agent.budgets.perRunUsd, SUMMARY_TOOL);

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
    hasRequiredOutput: () => run.draft.result !== null,
  };
}

async function cleanUp(deps: AgentDeps, run: BetterReviewRun): Promise<void> {
  try {
    if (run.checkout && run.context) {
      await deps.repoCache.removeCheckout(run.context.repo, run.checkout.path);
      await rm(dirname(run.checkout.path), { recursive: true, force: true });
    }
  } finally {
    closeRepos(deps, run.repos);
  }
}

// Like Code review, it reads the PR's repo, so it needs Read repositories on and the repo enabled.
function reviewRepo(repos: RepoAccess, repoName: string): RepoRef {
  if (!repos.isOn) {
    throw new Error("Better Review reads the PR's repo: switch on Read repositories in this agent's Config");
  }

  if (repos.repos.length === 0) {
    throw new Error(`repo "${repoName}" is disabled in Settings or not in the vault's catalog; its PRs get no review`);
  }

  return repos.repos[0];
}
