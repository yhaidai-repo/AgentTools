import type { GoalTaskData } from "@powerloom/core";
import { agentRun, localItem } from "@powerloom/db";
import { createRepoTools, defineTool, type RepoRef } from "@agenttools/runtime";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AgentRunSession } from "../AgentRunSession";
import { createFindingTools } from "../findingTools";
import { insertFindings } from "../findings";
import type { AgentRunInfo } from "../models/AgentRunInfo";
import type { AgentRunInput } from "../models/AgentRunInput";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import { reposByName } from "../research/resolveRepos";
import { createAzureTools } from "../azureTools";
import { createSqlTools } from "../sqlTools";
import { createAgentDocTools, numberOption, outsideAccessContext } from "../stage";
import type { GoalDraft } from "./models/GoalDraft";

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
  const acquired: RepoRef[] = [];
  const session = await AgentRunSession.begin(deps, info);

  try {
    const ran = await session.execute(info, () => prepare(context, session, task, data, draft, acquired));

    return await session.finish(ran, () => commit(context, task, session.runId, draft));
  } finally {
    deps.repoCache.release(acquired);
  }
}

async function prepare(context: TaskContext, session: AgentRunSession, task: ItemRow, data: GoalTaskData, draft: GoalDraft, acquired: RepoRef[]): Promise<AgentRunInput> {
  const { deps, agent, prompt, skills } = context;
  const { repos, unknown } = await reposByName(deps.db, task.vault, data.repos);

  await session.phase("context", { task: task.id, vault: task.vault, repos: repos.map((repo) => repo.name), unknown });
  await deps.repoCache.acquire(repos, (progress) => session.phase("repo", { ...progress }), numberOption(agent, "repoRefreshMinutes", 30));
  acquired.push(...repos);

  const firstMessage = buildFirstMessage(task, data, repos, unknown);

  await session.phase("first-message", { chars: firstMessage.length });

  const access = outsideAccessContext(agent.id, session.runId, task);

  return {
    capabilities: agent.capabilities,
    systemPrompt: [prompt.text, skills.promptSection].filter(Boolean).join("\n\n"),
    firstMessage,
    tools: [
      writeResultTool(draft),
      ...createRepoTools({ root: deps.repoCacheRoot, repos: repos.map((repo) => repo.name) }),
      ...createAgentDocTools(deps, agent.id, session.runId),
      ...createFindingTools(deps, draft.findings),
      ...skills.tools,
      ...createSqlTools(deps, agent, access),
      ...createAzureTools(deps, agent, access),
    ],
    limits: { maxTurns: agent.limits.maxTurns, timeoutMs: agent.limits.timeoutMinutes * 60_000 },
    perRunBudgetUsd: agent.budgets.perRunUsd,
    hasRequiredOutput: () => draft.result !== null,
  };
}

function buildFirstMessage(task: ItemRow, data: GoalTaskData, repos: RepoRef[], unknown: string[]): string {
  const repoLines = repos.map((repo) => `- ${repo.name} (branch ${repo.defaultBranch})`);
  const missing = unknown.length > 0 ? [`Not available (not among the vault's enabled repositories): ${unknown.join(", ")}.`] : [];

  return [
    `Scheduled task ${task.id}: ${task.title}`,
    "",
    "<goal>",
    data.goal,
    "</goal>",
    "",
    "<repos>",
    ...(repoLines.length > 0 ? repoLines : ["(none)"]),
    "</repos>",
    ...missing,
    "",
    "Work on the goal, then call write_result once with the result.",
  ].join("\n");
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
