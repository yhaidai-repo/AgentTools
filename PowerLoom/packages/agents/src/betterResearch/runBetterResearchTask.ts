import { requirePbiId } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { AgentRunSession } from "../AgentRunSession";
import { withBudgetNotes } from "../budget/budgetNotes";
import { DuplicateGuard } from "../DuplicateGuard";
import { ReadLog } from "../evidence/ReadLog";
import { recordReads } from "../evidence/recordReads";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { loadResearchContext } from "../research/loadResearchContext";
import { buildResearchMessage } from "../research/researchMessage";
import { docsReadInRun, skillsTrace } from "../stage";
import { createTaskTool } from "../taskCreation/createTaskTool";
import { createVaultCaptureTool } from "../vaultCapture";
import { commitBetterResearch } from "./commitBetterResearch";
import type { BetterResearchRun } from "./models/BetterResearchRun";
import { depthOf, readingTools, taskLimits } from "./researchToolset";
import { RESULT_TOOL, createResultTool } from "./resultTool";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "better-research";

// One Better Research task: one run; on success the result, the tasks it created and its drafts are committed. The repos
// it took from the cache are released whatever happens.
export async function runBetterResearchTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const info: AgentRunInfo = {
    stage: "better-research",
    pbiId: requirePbiId(task),
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: BetterResearchRun = { research: null, repos: noRepos(), readLog: null, draft: { result: null, tasks: [], captures: [], pages: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      const extra = { commits: run.repos.commits, docsRead: await docsReadInRun(deps, session.runId), docsVault: deps.docsVaultName };

      await commitBetterResearch(deps.db, run.research!, session.runId, { ...run.draft, result: run.draft.result! }, extra);
    };

    // A run stopped by its budget keeps the result it saved (status partial), so the work so far isn't lost.
    return await session.finish(ran, run.research ? commit : null, run.draft.result !== null);
  } finally {
    closeRepos(deps, run.repos);
  }
}

// Each step is a traced phase: context, every repo (clone / refresh / reuse, with time and commit), first message.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: BetterResearchRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const depth = depthOf(task);

  await session.phase("context", { task: task.id, depth, skills: skillsTrace(skills) });
  run.research = await loadResearchContext(deps, task);
  run.repos = await openRepos(context, session, await pbiRepoSources(deps.db, requirePbiId(task)));

  const firstMessage = await buildResearchMessage(deps.db, deps.vaultRoot, run.research, run.repos);
  const guard = await DuplicateGuard.load(deps.db, requirePbiId(task));
  const limits = await taskLimits(context, requirePbiId(task), depth);

  run.readLog = new ReadLog(firstMessage);
  await session.phase("first-message", { chars: firstMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: withBudgetNotes([
      ...recordReads(readingTools(context, session, task, run.repos), run.readLog),
      ...skills.tools,
      createTaskTool(agent.canAssign, run.draft.tasks, guard, run.readLog, limits),
      createResultTool(run.draft, run.readLog),
      ...(deps.captureRules ? [createVaultCaptureTool(run.draft.captures, deps.captureRules)] : []),
    ], () => session.spentUsd, agent.budgets.perRunUsd, RESULT_TOOL),
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    observe: (event) => run.readLog?.observe(event),
    hasRequiredOutput: () => run.draft.result !== null,
  };
}
