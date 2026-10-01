import { readAdoSettings } from "@adoa/core";
import { localItem, workItem } from "@adoa/db";
import type { AgentDefinition } from "@agenttools/config";
import { createDocTools, createRepoTools, type RepoRef } from "@agenttools/runtime";
import type { BudgetGuard } from "@agenttools/usage";
import { eq } from "drizzle-orm";
import { AgentRunSession } from "../AgentRunSession";
import { safeStep, throwIfErrors, type Step } from "../batchSteps";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { LoadedPrompt } from "../models/LoadedPrompt";
import type { StageSkills } from "../models/StageSkills";
import { loadPrompt } from "../prompts";
import { dailyGuard, docsReadInRun, loadRunnableStage, loadStageSkills, numberOption, pauseForRateLimit } from "../stage";
import { claimTask } from "./claimTask";
import { commitResearch } from "./commitResearch";
import { failResearch } from "./failResearch";
import type { ResearchContext } from "./models/ResearchContext";
import type { ResearchDraft } from "./models/ResearchDraft";
import type { ResearchRun } from "./models/ResearchRun";
import { buildResearchMessage } from "./researchMessage";
import { createResearchTools } from "./researchTools";
import { createVaultCaptureTool } from "../vaultCapture";
import { resolveRepos } from "./resolveRepos";
import { selectResearchTasks } from "./selectResearchTasks";

type TaskRow = typeof localItem.$inferSelect;

const AGENT = "research";

interface BatchContext {
  deps: AgentDeps;
  agent: AgentDefinition;
  prompt: LoadedPrompt;
  skills: StageSkills;
  guard: BudgetGuard;
}

// Scheduled job: answers up to `batchSize` research tasks, one agent run each, stopping early on budgets or rate limits.
export async function runResearchBatch(deps: AgentDeps): Promise<string> {
  const stage = await loadRunnableStage(deps, AGENT);

  if (!stage) {
    return "skipped: research disabled or agents paused";
  }

  const { agent, global } = stage;
  const tasks = await selectResearchTasks(deps.db, numberOption(agent, "batchSize", 2), numberOption(agent, "maxFailures", 3));
  const team = (await readAdoSettings(deps.db))?.team ?? "";
  const context: BatchContext = {
    deps,
    agent,
    prompt: await loadPrompt(AGENT, { team }),
    skills: await loadStageSkills(deps, agent),
    guard: dailyGuard(deps, agent, global),
  };
  const errors: string[] = [];
  let index = 0;
  let step: Step = "next";

  while (index < tasks.length && step === "next") {
    const task = tasks[index];

    step = await safeStep(AGENT, task.id, errors, () => researchOne(context, task));
    index += 1;
  }

  throwIfErrors(AGENT, errors);

  return `processed ${index} of ${tasks.length} tasks`;
}

async function researchOne(context: BatchContext, task: TaskRow): Promise<Step> {
  const decision = await context.guard.canStart({ agent: AGENT });

  if (!decision.allowed) {
    console.log(`research: ${decision.reason}`);

    return "stop";
  }

  const isClaimed = await claimTask(context.deps.db, task.id, task.pbiId);

  return isClaimed ? runClaimed(context, task) : "next";
}

async function runClaimed(context: BatchContext, task: TaskRow): Promise<Step> {
  const { deps } = context;
  const info: AgentRunInfo = {
    stage: "research",
    pbiId: task.pbiId,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: ResearchRun = { research: null, commits: {}, acquired: [], draft: { result: null, followUps: [], humanTasks: [], questions: [], captures: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));

    return await finishRun(context, session, task, run, ran);
  } finally {
    deps.repoCache.release(run.acquired);
  }
}

async function finishRun(context: BatchContext, session: AgentRunSession, task: TaskRow, run: ResearchRun, ran: Awaited<ReturnType<AgentRunSession["execute"]>>): Promise<Step> {
  const { deps, agent } = context;
  const commit = async () => {
    const extra = { commits: run.commits, docsRead: await docsReadInRun(deps, session.runId) };

    await commitResearch(deps.db, run.research!, session.runId, { ...run.draft, result: run.draft.result! }, extra);
  };
  const result = await session.finish(ran, run.research ? commit : null);

  console.log(`research ${task.id}: run ${result.runId} ${result.outcome}, $${result.costUsd.toFixed(4)}${result.error ? ` (${result.error})` : ""}`);

  if (result.outcome !== "success") {
    await failResearch(deps.db, task.id, task.pbiId, task.attempts, numberOption(agent, "maxFailures", 3), result.runId);
  }

  await deps.enqueueRender(task.pbiId);

  if (result.outcome !== "rate-limited") {
    return "next";
  }

  await pauseForRateLimit(deps, result.rateLimitResetsAt);

  return "stop";
}

// Each step is a traced phase: context, every repo (clone / refresh / reuse, with time and commit), first message.
async function prepare(context: BatchContext, session: AgentRunSession, task: TaskRow, run: ResearchRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const depth = Number((task.data as { depth?: number } | null)?.depth ?? 1);

  await session.phase("context", { task: task.id, depth, skills: skills.skills.map((skill) => skill.name) });
  run.research = await loadResearchContext(deps, task);
  await session.phase("repos", { repos: run.research.repos.map((repo) => repo.name), unknown: run.research.unknownRepos });
  run.commits = await deps.repoCache.acquire(run.research.repos, (progress) => session.phase("repo", { ...progress }));
  run.acquired = run.research.repos;

  const firstMessage = await buildResearchMessage(deps.db, deps.vaultRoot, run.research, run.commits);

  await session.phase("first-message", { chars: firstMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: [
      ...createDocTools({ root: deps.docsRoot, exclude: deps.docsExclude }),
      ...createRepoTools({ root: deps.repoCacheRoot, repos: repoNames(run.research.repos) }),
      ...skills.tools,
      ...createResearchTools(run.draft, depth, numberOption(agent, "maxDepth", 2)),
      ...(deps.captureRules ? [createVaultCaptureTool(run.draft.captures, deps.captureRules)] : []),
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => run.draft.result !== null,
  };
}

async function loadResearchContext(deps: AgentDeps, task: TaskRow): Promise<ResearchContext> {
  const [pbi] = await deps.db.select().from(workItem).where(eq(workItem.adoId, task.pbiId));
  const { repos, unknown } = await resolveRepos(deps.db, task.pbiId);

  return { task, pbi, repos, unknownRepos: unknown };
}

function repoNames(repos: RepoRef[]): string[] {
  return repos.map((repo) => repo.name);
}
