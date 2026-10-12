import { requirePbiId } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { createRepoTools, type RepoRef } from "@agenttools/runtime";
import { AgentRunSession } from "../AgentRunSession";
import { DuplicateGuard } from "../DuplicateGuard";
import { createAttachmentTool } from "../attachmentTools";
import { createConfluenceTools } from "../confluenceTools";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { withPagesRead } from "../relevantPages";
import { loadResearchContext } from "../research/loadResearchContext";
import { createSqlTools } from "../sqlTools";
import { confluencePagesReadInRun, createAgentDocTools, numberOption, skillsTrace } from "../stage";
import { createVaultCaptureTool } from "../vaultCapture";
import { commitDesign } from "./commitDesign";
import { buildDesignMessage } from "./designMessage";
import { createDesignTools } from "./designTools";
import type { DesignRun } from "./models/DesignRun";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "design";

// One design task (DT-…): one run on its PBI; on success the design or the gaps that stop it are committed.
// The repos it took from the cache are released whatever happens.
export async function runDesignTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const pbiId = requirePbiId(task);
  const info: AgentRunInfo = {
    stage: "design",
    pbiId,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: DesignRun = { context: null, commits: {}, acquired: [], draft: { design: null, gaps: [], captures: [], pages: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      const pages = withPagesRead(run.draft.pages, await confluencePagesReadInRun(deps, session.runId), "Read by design while designing.");

      await commitDesign(deps.db, task, pbiId, session.runId, { ...run.draft, pages });
    };

    return await session.finish(ran, commit);
  } finally {
    deps.repoCache.release(run.acquired);
  }
}

// Each step is a traced phase: context, every repo (clone / refresh / reuse), first message.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: DesignRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;

  await session.phase("context", { task: task.id, skills: skillsTrace(skills) });
  run.context = await loadResearchContext(deps, task);
  await session.phase("repos", { repos: repoNames(run.context.repos), unknown: run.context.unknownRepos });
  run.commits = await deps.repoCache.acquire(run.context.repos, (progress) => session.phase("repo", { ...progress }), numberOption(agent, "repoRefreshMinutes", 30));
  run.acquired = run.context.repos;

  const firstMessage = await buildDesignMessage(deps.db, deps.vaultRoot, run.context, run.commits);
  const guard = await DuplicateGuard.load(deps.db, requirePbiId(task));

  await session.phase("first-message", { chars: firstMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: [
      ...createAgentDocTools(deps, context.agent.id, session.runId),
      ...createRepoTools({ root: deps.repoCacheRoot, repos: repoNames(run.context.repos) }),
      ...skills.tools,
      createAttachmentTool(deps.db, requirePbiId(task)),
      ...createDesignTools(run.draft, guard),
      ...createConfluenceTools(deps, agent),
      ...createSqlTools(deps, agent),
      ...(deps.captureRules ? [createVaultCaptureTool(run.draft.captures, deps.captureRules)] : []),
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => hasOutput(run),
  };
}

// A design, or the questions and tasks for the user that stop it: either counts as a finished run.
function hasOutput(run: DesignRun): boolean {
  return run.draft.design !== null || run.draft.gaps.length > 0;
}

function repoNames(repos: RepoRef[]): string[] {
  return repos.map((repo) => repo.name);
}
