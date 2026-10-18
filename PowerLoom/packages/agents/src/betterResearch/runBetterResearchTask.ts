import { localItem } from "@powerloom/db";
import { AgentRunSession } from "../AgentRunSession";
import { withBudgetNotes } from "../budget/budgetNotes";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { RepoSource } from "../models/RepoSource";
import type { TaskContext } from "../models/TaskContext";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { loadResearchContext } from "../research/loadResearchContext";
import { buildResearchMessage, buildTaskResearchMessage } from "../research/researchMessage";
import { docsReadInRun, skillsTrace } from "../stage";
import { AgentToolset } from "../toolset/AgentToolset";
import { depthOf } from "../toolset/taskLimits";
import { toolsPromptSection } from "../toolset/toolsPromptSection";
import { commitBetterResearch } from "./commitBetterResearch";
import type { BetterResearchRun } from "./models/BetterResearchRun";
import { RESULT_TOOL, createResultTool } from "./resultTool";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "better-research";

// One Better Research task, with or without a PBI (a task the user created on the Tasks page runs the same way; user
// decision 2026-10-14): one run; on success the result, the tasks it created and its drafts are committed. The repos it
// took from the cache are released whatever happens.
export async function runBetterResearchTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const info: AgentRunInfo = {
    stage: "better-research",
    pbiId: task.pbiId,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: BetterResearchRun = { research: null, repos: noRepos(), toolset: null, draft: { result: null, tasks: [], captures: [], pages: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      const extra = { commits: run.repos.commits, docsRead: await docsReadInRun(deps, session.runId), docsVault: deps.docsVaultName };

      await commitBetterResearch(deps.db, task, run.research?.pbi ?? null, session.runId, { ...run.draft, result: run.draft.result! }, extra);
      await run.toolset?.commit(session.runId);
    };

    // A run stopped by its budget keeps the result it saved (status partial), so the work so far isn't lost.
    return await session.finish(ran, run.toolset ? commit : null, run.draft.result !== null);
  } finally {
    closeRepos(deps, run.repos);
  }
}

// Each step is a traced phase: context, every repo (clone / refresh / reuse, with time and commit), first message.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: BetterResearchRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const depth = depthOf(task);

  await session.phase("context", { task: task.id, pbi: task.pbiId, depth, skills: skillsTrace(skills) });
  run.research = task.pbiId === null ? null : await loadResearchContext(deps, task);
  run.repos = await openRepos(context, session, await repoSources(context, task), { vault: task.vault });

  const toolset = await AgentToolset.open(context, session, task, { repos: run.repos, depth, createTask: true, tasks: run.draft.tasks, captures: run.draft.captures });
  const taskMessage = run.research ? await buildResearchMessage(deps.db, deps.vaultRoot, run.research, run.repos) : buildTaskResearchMessage(task, run.repos);
  const firstMessage = [taskMessage, toolset.webDocumentsBlock()].filter(Boolean).join("\n\n");
  const tools = withBudgetNotes([...toolset.tools(firstMessage), createResultTool(run.draft, toolset.readLog)], () => session.spentUsd, agent.budgets.perRunUsd, RESULT_TOOL);

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

// The PBI's repos; a task without a PBI names its own (the Tasks page's repo choice).
async function repoSources(context: TaskContext, task: ItemRow): Promise<RepoSource[]> {
  if (task.pbiId !== null) {
    return pbiRepoSources(context.deps.db, task.pbiId);
  }

  return [{ vault: task.vault, names: (task.data as { repos?: string[] } | null)?.repos ?? [] }];
}
