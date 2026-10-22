import { setItemStatus } from "@powerloom/core";
import { localItem, runResult, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import { AgentRunSession } from "../AgentRunSession";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { RepoSource } from "../models/RepoSource";
import type { TaskContext } from "../models/TaskContext";
import { pbiRepoSources } from "../repos/agentRepos";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { reposBlock } from "../repos/reposBlock";
import { acceptanceCriteriaBlock } from "../tasks/userTasks";
import { recordWaiting } from "../tasks/waiting";
import { AgentToolset } from "../toolset/AgentToolset";
import { toolsPromptSection } from "../toolset/toolsPromptSection";
import type { GenericRun } from "./models/GenericRun";

type ItemRow = typeof localItem.$inferSelect;

const ACTOR = "agent-runner";

// One task of an agent without code of its own (user decision 2026-10-22): its prompt, the framework and its skills as
// instructions; the task, the PBI's context (AgentRunSession adds it) and the task's latest result as the first message;
// whatever its Config grants as tools; write_result as the run's required output. A result that isn't complete and
// handed work on puts the task back to open until that work closes.
export async function runGenericTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps, agent } = context;
  const info: AgentRunInfo = {
    stage: agent.id,
    pbiId: task.pbiId,
    itemId: task.id,
    labels: { agent: agent.id, item: task.id },
    model: agent.model,
    promptVersion: context.prompt.version,
  };
  const run: GenericRun = { repos: noRepos(), toolset: null };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, run));

    return await session.finish(ran, () => commit(deps.db, task, session.runId, run));
  } finally {
    closeRepos(deps, run.repos);
  }
}

async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, run: GenericRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;

  await session.phase("context", { task: task.id, vault: task.vault });
  run.repos = await openRepos(context, session, await repoSources(context, task), { vault: task.vault });

  const toolset = await AgentToolset.open(context, session, task, { repos: run.repos });
  const firstMessage = await buildFirstMessage(deps.db, task, run, toolset.webDocumentsBlock());
  const tools = toolset.tools(firstMessage);

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
    hasRequiredOutput: () => toolset.result.isWritten,
  };
}

// The PBI's repos; a task without a PBI names its own (the Tasks page's repo choice).
async function repoSources(context: TaskContext, task: ItemRow): Promise<RepoSource[]> {
  if (task.pbiId !== null) {
    return pbiRepoSources(context.deps.db, task.pbiId);
  }

  return [{ vault: task.vault, names: (task.data as { repos?: string[] } | null)?.repos ?? [] }];
}

async function buildFirstMessage(db: PowerLoomDb, task: ItemRow, run: GenericRun, webDocuments: string): Promise<string> {
  return [
    taskBlock(task),
    acceptanceCriteriaBlock(task),
    await previousResultBlock(db, task.id),
    webDocuments,
    reposBlock(run.repos),
    "Work on the task, then call write_result once with the result.",
  ].filter(Boolean).join("\n\n");
}

function taskBlock(task: ItemRow): string {
  const data = (task.data ?? {}) as { why?: string; doneWhen?: string };
  const lines = [
    `Id: ${task.id}`,
    `Kind: ${task.kind}`,
    `Title: ${task.title}`,
    ...(data.why ? [`Why: ${data.why}`] : []),
    ...(data.doneWhen ? [`Done when: ${data.doneWhen}`] : []),
  ];

  return ["<task>", ...lines, "", task.body ?? "", "</task>"].join("\n");
}

// The task's latest result, so a rerun continues instead of starting over (as Autotest's previous report did).
async function previousResultBlock(db: PowerLoomDb, taskId: string): Promise<string> {
  const [previous] = await db.select({ runId: runResult.runId, status: runResult.status, body: runResult.body })
    .from(runResult).where(eq(runResult.taskId, taskId)).orderBy(desc(runResult.createdAt)).limit(1);

  if (!previous) {
    return "";
  }

  const run = previous.runId === null ? "an earlier run" : `RUN-${previous.runId}`;

  return [`<previous-result run="${run}" status="${previous.status}">`, previous.body, "</previous-result>", "Continue from it: don't redo what it settled; write the whole result again as this run's."].join("\n");
}

// What the shared tools created becomes items; a result that isn't complete waits for the tasks it handed on.
async function commit(db: PowerLoomDb, task: ItemRow, runId: number, run: GenericRun): Promise<void> {
  const created = await run.toolset?.commit(runId);
  const result = run.toolset?.result.latest;
  const handedOn = created !== undefined && created.taskIds.length > 0;

  if (result?.status !== "complete" && handedOn) {
    await setItemStatus(db, task.id, "in-progress", "open", ACTOR);
    await recordWaiting(db, task, runId, created.taskIds);
  }
}
