import { requirePbiId } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { createRepoTools, type RepoRef, type ToolDefinition } from "@agenttools/runtime";
import { AgentRunSession } from "../AgentRunSession";
import { DuplicateGuard } from "../DuplicateGuard";
import { createAttachmentTool } from "../attachmentTools";
import { createAzureTools } from "../azureTools";
import { createConfluenceTools } from "../confluenceTools";
import { ReadLog } from "../evidence/ReadLog";
import { recordReads } from "../evidence/recordReads";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { createReadPbiTool } from "../pbiContext/readPbiTool";
import { loadResearchContext } from "../research/loadResearchContext";
import { buildResearchMessage } from "../research/researchMessage";
import { createSqlTools } from "../sqlTools";
import { createAgentDocTools, docsReadInRun, numberOption, outsideAccessContext, skillsTrace } from "../stage";
import { countAgentCreatedTasks } from "../taskCreation/commitCreatedTasks";
import { createTaskTool } from "../taskCreation/createTaskTool";
import type { TaskCreationLimits } from "../taskCreation/models/TaskCreationLimits";
import { createVaultCaptureTool } from "../vaultCapture";
import { commitBetterResearch } from "./commitBetterResearch";
import type { BetterResearchRun } from "./models/BetterResearchRun";
import { createResultTool } from "./resultTool";

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
  const run: BetterResearchRun = { research: null, commits: {}, acquired: [], readLog: null, draft: { result: null, tasks: [], captures: [], pages: [] } };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));
    const commit = async () => {
      const extra = { commits: run.commits, docsRead: await docsReadInRun(deps, session.runId), docsVault: deps.docsVaultName };

      await commitBetterResearch(deps.db, run.research!, session.runId, { ...run.draft, result: run.draft.result! }, extra);
    };

    return await session.finish(ran, run.research ? commit : null);
  } finally {
    deps.repoCache.release(run.acquired);
  }
}

// Each step is a traced phase: context, every repo (clone / refresh / reuse, with time and commit), first message.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: BetterResearchRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const depth = depthOf(task);

  await session.phase("context", { task: task.id, depth, skills: skillsTrace(skills) });
  run.research = await loadResearchContext(deps, task);
  await session.phase("repos", { repos: run.research.repos.map((repo) => repo.name), unknown: run.research.unknownRepos });
  run.commits = await deps.repoCache.acquire(run.research.repos, (progress) => session.phase("repo", { ...progress }), numberOption(agent, "repoRefreshMinutes", 30));
  run.acquired = run.research.repos;

  const firstMessage = await buildResearchMessage(deps.db, deps.vaultRoot, run.research, run.commits);
  const guard = await DuplicateGuard.load(deps.db, requirePbiId(task));
  const limits = await taskLimits(context, task, depth);

  run.readLog = new ReadLog(firstMessage);
  await session.phase("first-message", { chars: firstMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: [
      ...recordReads(readingTools(context, session, task, run.research.repos), run.readLog),
      ...skills.tools,
      createTaskTool(agent.canAssign, run.draft.tasks, guard, run.readLog, limits),
      createResultTool(run.draft, run.readLog),
      ...(deps.captureRules ? [createVaultCaptureTool(run.draft.captures, deps.captureRules)] : []),
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => run.draft.result !== null,
  };
}

// Only these results get a source id the evidence can cite; writing tools stay out (see recordReads). read_pbi and
// read_attachment are listed here, so the session's PBI context doesn't add them again untagged (withPbiContext).
function readingTools(context: TaskContext, session: AgentRunSession, task: ItemRow, repos: RepoRef[]): ToolDefinition<any>[] {
  const { deps, agent } = context;
  const access = outsideAccessContext(agent.id, session.runId, task);

  return [
    ...createAgentDocTools(deps, agent.id, session.runId),
    ...createRepoTools({ root: deps.repoCacheRoot, repos: repos.map((repo) => repo.name) }),
    createAttachmentTool(deps.db, requirePbiId(task)),
    createReadPbiTool(deps.db, deps.vaultRoot),
    ...createConfluenceTools(deps, agent, access),
    ...createSqlTools(deps, agent, access),
    ...createAzureTools(deps, agent, access),
  ];
}

async function taskLimits(context: TaskContext, task: ItemRow, depth: number): Promise<TaskCreationLimits> {
  const { agent, deps } = context;

  return {
    depth,
    maxDepth: numberOption(agent, "maxDepth", 3),
    maxPerRun: numberOption(agent, "maxTasksPerRun", 5),
    maxPerPbi: numberOption(agent, "maxTasksPerPbi", 15),
    createdOnPbi: await countAgentCreatedTasks(deps.db, requirePbiId(task)),
  };
}

function depthOf(task: ItemRow): number {
  return Number((task.data as { depth?: number } | null)?.depth ?? 1);
}
