import { readAdoSettings, type AgentRunJob } from "@adoa/core";
import { localItem } from "@adoa/db";
import { isPaused } from "@agenttools/config";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import type { TaskExecutor } from "../models/TaskExecutor";
import { runCodeReviewTask } from "../codeReview/runCodeReviewTask";
import { runDesignTask } from "../design/runDesignTask";
import { loadPrompt } from "../prompts";
import { runRefinementTask } from "../refinement/runRefinementTask";
import { runResearchTask } from "../research/runResearchTask";
import { runTechWriterTask } from "../techWriter/runTechWriterTask";
import { runVaultReviewTask } from "../vaultReview/runVaultReviewTask";
import { dailyGuard, loadStageSkills, numberOption } from "../stage";
import { endTask, failAfterError, releaseTask } from "./endTask";

type ItemRow = typeof localItem.$inferSelect;

const EXECUTORS: Record<string, TaskExecutor> = {
  refinement: runRefinementTask,
  research: runResearchTask,
  design: runDesignTask,
  "tech-writer": runTechWriterTask,
  "code-review": runCodeReviewTask,
  "vault-review": runVaultReviewTask,
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
    await failAfterError(deps.db, task, await maxFailuresFor(deps, job.agentId));
    throw error;
  }
}

async function runChecked(deps: AgentDeps, agentId: string, task: ItemRow): Promise<AgentRunResult | null> {
  const context = await loadTaskContext(deps, agentId, task.pbiId);
  const refusal = await refusalReason(context, agentId);

  if (refusal) {
    await releaseTask(deps.db, task, refusal);

    return null;
  }

  const result = await EXECUTORS[agentId](context, task);

  console.log(`${agentId} ${task.id}: run ${result.runId} ${result.outcome}, $${result.costUsd.toFixed(4)}${result.error ? ` (${result.error})` : ""}`);
  await endTask(deps, context.agent, task, result);

  return result;
}

async function loadTaskContext(deps: AgentDeps, agentId: string, pbiId: number | null): Promise<TaskContext> {
  const agent = await deps.config.get(agentId);

  if (!agent) {
    throw new Error(`agent "${agentId}" is not configured`);
  }

  const team = (await readAdoSettings(deps.db))?.team ?? "";

  return {
    deps,
    agent,
    global: await deps.config.getGlobal(),
    prompt: EXECUTORS[agentId] ? await loadPrompt(agentId, { team }) : { text: "", version: "none" },
    skills: await loadStageSkills(deps, agent, pbiId),
  };
}

async function refusalReason(context: TaskContext, agentId: string): Promise<string | null> {
  if (!EXECUTORS[agentId]) {
    return `agent "${agentId}" can't run tasks yet`;
  }

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
