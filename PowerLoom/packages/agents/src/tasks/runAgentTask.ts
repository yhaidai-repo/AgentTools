import { readAdoSettings, type AgentRunJob } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { isPaused } from "@agenttools/config";
import { eq } from "drizzle-orm";
import type { AgentDeps } from "../models/AgentDeps";
import type { AgentRunResult } from "../models/AgentRunResult";
import type { TaskContext } from "../models/TaskContext";
import type { TaskExecutor } from "../models/TaskExecutor";
import { runCodeReviewTask } from "../codeReview/runCodeReviewTask";
import { runDesignTask } from "../design/runDesignTask";
import { runGoalTask } from "../goal/runGoalTask";
import { loadPrompt } from "../prompts";
import { runRefinementTask } from "../refinement/runRefinementTask";
import { runResearchTask } from "../research/runResearchTask";
import { runBetterResearchTask } from "../betterResearch/runBetterResearchTask";
import { runBetterRefinementTask } from "../betterRefinement/runBetterRefinementTask";
import { runBetterReviewTask } from "../betterReview/runBetterReviewTask";
import { runTechWriterTask } from "../techWriter/runTechWriterTask";
import { runVaultReviewTask } from "../vaultReview/runVaultReviewTask";
import { runMeetingNotesTask } from "../meetingNotes/runMeetingNotesTask";
import { runAutotestTask } from "../autotest/runAutotestTask";
import { dailyGuard, loadStageSkills, numberOption } from "../stage";
import { endTask, failAfterError, releaseTask } from "./endTask";

type ItemRow = typeof localItem.$inferSelect;

const EXECUTORS: Record<string, TaskExecutor> = {
  refinement: runRefinementTask,
  research: runResearchTask,
  "better-research": runBetterResearchTask,
  "better-refinement": runBetterRefinementTask,
  design: runDesignTask,
  "tech-writer": runTechWriterTask,
  "code-review": runCodeReviewTask,
  "better-review": runBetterReviewTask,
  "vault-review": runVaultReviewTask,
  "meeting-notes": runMeetingNotesTask,
  autotest: runAutotestTask,
};

// Scheduled goal tasks (GT-…) run the generic goal prompt; every other task, with or without a PBI, runs its agent's own
// executor (user decision 2026-10-14: a task the user creates goes the same way as every other task).
function runsAsGoal(task: ItemRow): boolean {
  return task.kind === "goal";
}

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

  const executor = runsAsGoal(task) ? runGoalTask : EXECUTORS[agentId];
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
    prompt: await taskPrompt(agentId, task, { team, agent: agent.label }),
    skills: await loadStageSkills(deps, agent, task.pbiId),
  };
}

// A goal task has its own prompt (user decision 2026-10-06); every other task uses the agent's.
async function taskPrompt(agentId: string, task: ItemRow, values: Record<string, string>): Promise<TaskContext["prompt"]> {
  if (runsAsGoal(task)) {
    return loadPrompt("goal", values);
  }

  return EXECUTORS[agentId] ? loadPrompt(agentId, values) : { text: "", version: "none" };
}

async function refusalReason(context: TaskContext, agentId: string, task: ItemRow): Promise<string | null> {
  if (!runsAsGoal(task) && !EXECUTORS[agentId]) {
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
