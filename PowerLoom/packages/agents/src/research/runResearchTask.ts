import { requirePbiId } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { createRepoTools, type RepoRef } from "@agenttools/runtime";
import { AgentRunSession } from "../AgentRunSession";
import { DuplicateGuard } from "../DuplicateGuard";
import { createAttachmentTool } from "../attachmentTools";
import { createConfluenceTools } from "../confluenceTools";
import { createWebResearchTool } from "../webResearch";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { createAgentDocTools, docsReadInRun, numberOption, skillsTrace } from "../stage";
import { createVaultCaptureTool } from "../vaultCapture";
import { commitResearch } from "./commitResearch";
import { loadResearchContext } from "./loadResearchContext";
import type { ResearchRun } from "./models/ResearchRun";
import { buildResearchMessage } from "./researchMessage";
import { createResearchTools } from "./researchTools";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "research";

// One research task (AT-…): one run; on success the result, follow-ups, human tasks, questions and drafts are committed.
// The repos it took from the cache are released whatever happens.
export async function runResearchTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const info: AgentRunInfo = {
    stage: "research",
    pbiId: requirePbiId(task),
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: ResearchRun = { research: null, commits: {}, acquired: [], draft: { result: null, followUps: [], humanTasks: [], questions: [], captures: [], webResearch: [], pages: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      const extra = { commits: run.commits, docsRead: await docsReadInRun(deps, session.runId) };

      await commitResearch(deps.db, run.research!, session.runId, { ...run.draft, result: run.draft.result! }, extra);
    };

    return await session.finish(ran, run.research ? commit : null);
  } finally {
    deps.repoCache.release(run.acquired);
  }
}

// Each step is a traced phase: context, every repo (clone / refresh / reuse, with time and commit), first message.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: ResearchRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const depth = Number((task.data as { depth?: number } | null)?.depth ?? 1);

  await session.phase("context", { task: task.id, depth, skills: skillsTrace(skills) });
  run.research = await loadResearchContext(deps, task);
  await session.phase("repos", { repos: run.research.repos.map((repo) => repo.name), unknown: run.research.unknownRepos });
  run.commits = await deps.repoCache.acquire(run.research.repos, (progress) => session.phase("repo", { ...progress }), numberOption(agent, "repoRefreshMinutes", 30));
  run.acquired = run.research.repos;

  const firstMessage = await buildResearchMessage(deps.db, deps.vaultRoot, run.research, run.commits);
  const guard = await DuplicateGuard.load(deps.db, requirePbiId(task));

  await session.phase("first-message", { chars: firstMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: [
      ...createAgentDocTools(deps, context.agent.id, session.runId),
      ...createRepoTools({ root: deps.repoCacheRoot, repos: repoNames(run.research.repos) }),
      ...skills.tools,
      createAttachmentTool(deps.db, requirePbiId(task)),
      ...createResearchTools(run.draft, depth, numberOption(agent, "maxDepth", 2), guard),
      ...(agent.capabilities.webAccess ? [] : [createWebResearchTool(run.draft.webResearch, guard)]),
      ...createConfluenceTools(deps, agent),
      ...(deps.captureRules ? [createVaultCaptureTool(run.draft.captures, deps.captureRules)] : []),
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => run.draft.result !== null,
  };
}

function repoNames(repos: RepoRef[]): string[] {
  return repos.map((repo) => repo.name);
}
