import type { GoalTaskData } from "@powerloom/core";
import { agentRun, localItem } from "@powerloom/db";
import { defineTool } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AgentRunSession } from "../AgentRunSession";
import { createFindingTools } from "../findingTools";
import { insertFindings } from "../findings";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { RepoAccess } from "../models/RepoAccess";
import type { TaskContext } from "../models/TaskContext";
import { closeRepos, noRepos, openRepos } from "../repos/openRepos";
import { reposBlock } from "../repos/reposBlock";
import { acceptanceCriteriaBlock, goalTextOf } from "../tasks/userTasks";
import { createAzureTools } from "../azureTools";
import { createDevHubTools } from "../devHubTools";
import { createSqlTools } from "../sqlTools";
import { createAgentDocTools, outsideAccessContext } from "../stage";
import type { GoalDraft } from "./models/GoalDraft";
import type { GoalRun } from "./models/GoalRun";

type ItemRow = typeof localItem.$inferSelect;
type Stage = typeof agentRun.$inferSelect["stage"];

// A scheduled goal task (GT-…) of any agent (user decision 2026-10-06): the goal on the chosen repos; a goal filed under a
// PBI gets the PBI's context too. The agent reads code and docs and writes one result, which becomes the task's resolution.
export async function runGoalTask(context: TaskContext, task: ItemRow): Promise<AgentRunResult> {
  const { deps, agent } = context;
  const data = task.data as GoalTaskData;
  const info: AgentRunInfo = {
    stage: agent.id as Stage,
    pbiId: task.pbiId,
    itemId: task.id,
    labels: { agent: agent.id, item: task.id },
    model: agent.model,
    promptVersion: context.prompt.version,
  };
  const draft: GoalDraft = { result: null, findings: [] };
  const run: GoalRun = { repos: noRepos() };
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, data, draft, run));

    return await session.finish(ran, () => commit(context, task, session.runId, draft));
  } finally {
    closeRepos(deps, run.repos);
  }
}

// The schedule's repos are the ones attached to the task.
async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, data: GoalTaskData, draft: GoalDraft, run: GoalRun): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;

  await session.phase("context", { task: task.id, vault: task.vault });
  run.repos = await openRepos(context, session, [{ vault: task.vault, names: data.repos }]);

  const firstMessage = buildFirstMessage(task, data, run.repos);

  await session.phase("first-message", { chars: firstMessage.length });

  const access = outsideAccessContext(agent.id, session.runId, task);

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: [
      writeResultTool(draft),
      ...run.repos.tools,
      ...createAgentDocTools(deps, agent.id, session.runId),
      ...createFindingTools(deps, draft.findings),
      ...skills.tools,
      ...createSqlTools(deps, agent, access),
      ...createAzureTools(deps, agent, access),
      ...createDevHubTools(deps, agent, access),
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => draft.result !== null,
  };
}

function buildFirstMessage(task: ItemRow, data: GoalTaskData, repos: RepoAccess): string {
  return [
    `Task ${task.id}: ${task.title}`,
    `<goal>\n${goalTextOf(task, data.goal)}\n</goal>`,
    acceptanceCriteriaBlock(task),
    reposBlock(repos),
    "Work on the goal, then call write_result once with the result.",
  ].filter(Boolean).join("\n\n");
}

function writeResultTool(draft: GoalDraft) {
  return defineTool({
    name: "write_result",
    description: "The task's result, once, at the end: what you found or produced, the evidence (files, symbols, notes) and open points, in Markdown.",
    input: { result: z.string().min(1) },
    handler: async ({ result }) => {
      draft.result = result;

      return { text: "Result recorded." };
    },
  });
}

// The result becomes the task's resolution; findings become items for the user; the run lists both.
async function commit(context: TaskContext, task: ItemRow, runId: number, draft: GoalDraft): Promise<void> {
  const { db } = context.deps;
  const findingIds = await insertFindings(db, task, runId, draft.findings);
  const firstLine = (draft.result ?? "").split(/\r?\n/).find((line) => line.trim()) ?? "";

  await db.update(localItem).set({ resolution: draft.result }).where(eq(localItem.id, task.id));
  await db.update(agentRun).set({ outputs: [`result: ${firstLine.slice(0, 120)}`, ...findingIds] }).where(eq(agentRun.id, runId));
}
