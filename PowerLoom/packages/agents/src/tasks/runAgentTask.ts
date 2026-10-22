import { readAdoSettings, type AgentRunJob } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { isPaused } from "@agenttools/config";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import type { TaskExecutor } from "../models/TaskExecutor";
import { runCodeReviewTask } from "../codeReview/runCodeReviewTask";
import { runGenericTask } from "../generic/runGenericTask";
import { loadAgentPrompt } from "../prompts";
import { runBetterReviewTask } from "../betterReview/runBetterReviewTask";
import { runAutotestTask } from "../autotest/runAutotestTask";
import { dailyGuard, loadStageSkills, numberOption } from "../stage";
import { endTask, failAfterError, releaseTask } from "./endTask";

type ItemRow = typeof localItem.$inferSelect;

// Agents with code of their own; any other agent (created in the UI) runs the generic executor (user decision 2026-10-22).
const EXECUTORS: Record<string, TaskExecutor> = {
  "code-review": runCodeReviewTask,
  "better-review": runBetterReviewTask,
  autotest: runAutotestTask,
};

// One task the dispatcher validated and claimed. Rechecked here (the dispatcher's view can be a minute old), run, ended.
// Returns null when the task was handed back without a run. An unexpected error still ends the task, then fails the job.
export async function runAgentTask(deps: AgentDeps, job: AgentRunJob): Promise<AgentRunResult | null> {
  const [task] = await deps.db.select().from(localItem).where(eq(localItem.id, job.taskId));

  if (task?.status !== "in-progress") {
    console.log(`${job.agentId} ${job.taskId}: not in progress any more (${task?.status ?? "gone"}), skipped`);

    return null;
  }

  try {
    return await runChecked(deps, job.agentId, task);
  } catch (error) {
    await failAfterError(deps.db, task, await maxFailuresFor(deps, job.agentId), error);
    throw error;
  }
}

async function runChecked(deps: AgentDeps, agentId: string, task: ItemRow): Promise<AgentRunResult | null> {
  const context = await loadTaskContext(deps, agentId, task);
  const refusal = await refusalReason(context, agentId, task);

  if (refusal) {
    await releaseTask(deps.db, task, refusal);

    return null;
  }

  const executor = EXECUTORS[agentId] ?? runGenericTask;
  const result = await executor(context, task);

  console.log(`${agentId} ${task.id}: run ${result.runId} ${result.outcome}, $${result.costUsd.toFixed(4)}${result.error ? ` (${result.error})` : ""}`);
  await endTask(deps, context.agent, task, result);

  return result;
}

async function loadTaskContext(deps: AgentDeps, agentId: string, task: ItemRow): Promise<TaskContext> {
  const agent = await deps.config.get(agentId);

  if (!agent) {
    throw new Error(`agent "${agentId}" is not configured`);
  }

  const team = (await readAdoSettings(deps.db, task.vault))?.team ?? "";

  return {
    deps,
    agent,
    global: await deps.config.getGlobal(),
    prompt: await loadAgentPrompt(agentId, agent.prompt ?? "", { team, agent: agent.label }),
    skills: await loadStageSkills(deps, agent, task.pbiId),
  };
}

async function refusalReason(context: TaskContext, agentId: string, task: ItemRow): Promise<string | null> {
  if (!context.agent.enabled || isPaused(context.global)) {
    return context.agent.enabled ? "agents are paused" : `agent "${agentId}" is disabled`;
  }

  const decision = await dailyGuard(context.deps, context.agent, context.global).canStart({ agent: agentId });

  return decision.allowed ? null : `budget: ${decision.reason}`;
}

async function maxFailuresFor(deps: AgentDeps, agentId: string): Promise<number> {
  const agent = await deps.config.get(agentId);

  return agent ? numberOption(agent, "maxFailures", 3) : 1;
}
