import { setItemStatus, type GoalTaskData } from "@powerloom/core";
import { agentRun, localItem, workItem } from "@powerloom/db";
import type { ToolDefinition } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { AgentRunSession } from "../AgentRunSession";
import { DuplicateGuard } from "../DuplicateGuard";
import { withBudgetNotes } from "../budget/budgetNotes";
import { ReadLog } from "../evidence/ReadLog";
import { recordReads } from "../evidence/recordReads";
import { createFindingTools } from "../findingTools";
import { insertFindings } from "../findings";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { RepoAccess } from "../models/RepoAccess";
import type { TaskContext } from "../models/TaskContext";
import { backlogMountOf, buildPbiContext } from "@powerloom/core";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { reposBlock } from "../repos/reposBlock";
import { skillsTrace } from "../stage";
import { commitCreatedTasks } from "../taskCreation/commitCreatedTasks";
import { createTaskTool } from "../taskCreation/createTaskTool";
import type { FindingDraft } from "../techWriter/models/FindingDraft";
import type { BetterResearchDraft } from "./models/BetterResearchDraft";
import { renderResult } from "./renderResult";
import { depthOf, readingTools, taskLimits } from "./researchToolset";
import { RESULT_TOOL, createResultTool } from "./resultTool";

type ItemRow = typeof localItem.$inferSelect;

const AGENT = "better-research";
const ACTOR = "agent:better-research";

type GoalRun = { repos: RepoAccess; readLog: ReadLog | null; draft: BetterResearchDraft; findings: FindingDraft[] };

// A goal task (GT-…, Tasks → New task) for Better Research: any spike or investigation, with or without a PBI (user
// request 2026-10-13). Same prompt, framework, evidence and result as a PBI task; the result becomes the task's
// resolution. Agent and user tasks are numbered per PBI, so a goal without one reports open points as findings instead.
export async function runBetterResearchGoal(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps } = context;
  const info: AgentRunInfo = {
    stage: "better-research",
    pbiId: task.pbiId,
    itemId: task.id,
    labels: { agent: AGENT, item: task.id },
    model: context.agent.model,
    promptVersion: context.prompt.version,
  };
  const run: GoalRun = { repos: noRepos(), readLog: null, draft: { result: null, tasks: [], captures: [], pages: [] }, findings: [] };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));

    return await session.finish(ran, () => commit(context, task, session.runId, run), run.draft.result !== null);
  } finally {
    closeRepos(deps, run.repos);
  }
}

async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: GoalRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const data = task.data as GoalTaskData;

  await session.phase("context", { task: task.id, vault: task.vault, pbi: task.pbiId, skills: skillsTrace(skills) });
  run.repos = await openRepos(context, session, [{ vault: task.vault, names: data.repos ?? [] }]);

  const firstMessage = [goalMessage(task, data, run.repos), ...(await pbiContextOf(deps, task.pbiId))].join("\n\n");

  run.readLog = new ReadLog(firstMessage);
  await session.phase("first-message", { chars: firstMessage.length });

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: withBudgetNotes([
      ...recordReads(readingTools(context, session, task, run.repos), run.readLog),
      ...skills.tools,
      ...(await handOnTools(context, task, run)),
      createResultTool(run.draft, run.readLog),
    ], () => session.spentUsd, agent.budgets.perRunUsd, RESULT_TOOL),
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    observe: (event) => run.readLog?.observe(event),
    hasRequiredOutput: () => run.draft.result !== null,
  };
}

// Under a PBI the goal hands on like any PBI task; without one, open points become findings for the user.
async function handOnTools(context: TaskContext, task: ItemRow, run: GoalRun): Promise<ToolDefinition<any>[]> {
  if (task.pbiId === null) {
    return createFindingTools(context.deps, run.findings);
  }

  const guard = await DuplicateGuard.load(context.deps.db, task.pbiId);
  const limits = await taskLimits(context, task.pbiId, depthOf(task));

  return [createTaskTool(context.agent.canAssign, run.draft.tasks, guard, run.readLog!, limits)];
}

// Built here, not added by the session afterwards, so the read log's S0 holds it too.
async function pbiContextOf(deps: AgentDeps, pbiId: number | null): Promise<string[]> {
  if (pbiId === null) {
    return [];
  }

  const [row] = await deps.db.select().from(workItem).where(eq(workItem.adoId, pbiId));

  return row ? [await buildPbiContext(deps.db, backlogMountOf(deps.vaultRoot), row)] : [];
}

function goalMessage(task: ItemRow, data: GoalTaskData, repos: RepoAccess): string {
  return [
    `Answer this research task (${task.id}): ${task.title}`,
    "",
    "<goal>",
    data.goal,
    "</goal>",
    "",
    reposBlock(repos),
  ].join("\n");
}

// The result is the task's resolution (Markdown) and stays structured in its data; the task closes here, so a run kept
// after a budget stop ends done as well.
async function commit(context: TaskContext, task: ItemRow, runId: number, run: GoalRun): Promise<void> {
  const { db } = context.deps;
  const result = run.draft.result!;
  const taskIds = task.pbiId === null ? [] : await commitCreatedTasks(db, { pbiId: task.pbiId, parentTaskId: task.id, runId, depth: depthOf(task), docsVault: context.deps.docsVaultName }, run.draft.tasks);
  const findingIds = await insertFindings(db, task, runId, run.findings);

  await db.update(localItem).set({ resolution: renderResult(result), data: { ...(task.data as object), result, resultVersion: 2 } }).where(eq(localItem.id, task.id));
  await db.update(agentRun).set({ outputs: [`result: ${result.status}, ${result.question.slice(0, 100)}`, ...taskIds, ...findingIds] }).where(eq(agentRun.id, runId));
  await setItemStatus(db, task.id, "in-progress", "done", ACTOR, runId);
}
