import { AGENT_RUN_QUEUE, readCurrentSprint, setItemStatus, syncPipelineStatus, validateTask, type AgentRunJob } from "@adoa/core";
import { localItem, workItem } from "@adoa/db";
import { isPaused, type AgentDefinition } from "@agenttools/config";
import { and, asc, eq, sql } from "drizzle-orm";
import { syncConfluencePages } from "../documents/confluencePages";
import type { WorkerContext } from "../models/WorkerContext";

type ItemRow = typeof localItem.$inferSelect;

const ACTOR = "worker";

// The agent's schedule or "Run now": its open tasks in priority order (current sprint, ADO backlog order, age), each
// through the validator; a held task keeps its reasons, a valid one is claimed and handed to the agent-runner,
// up to the agent's batch size.
export async function dispatchAgent(context: WorkerContext, agentId: string): Promise<string> {
  const agent = await context.config.get(agentId);
  const skip = await skipReason(context, agent);

  if (skip || !agent) {
    return `${agentId}: skipped (${skip})`;
  }

  const tasks = await openTasks(context, agentId);
  const limit = batchSize(agent);
  let started = 0;

  for (let index = 0; index < tasks.length && started < limit; index += 1) {
    started += (await tryStart(context, agent, tasks[index])) ? 1 : 0;
  }

  return `${agentId}: started ${started} of ${tasks.length} open task(s)`;
}

async function skipReason(context: WorkerContext, agent: AgentDefinition | null): Promise<string | null> {
  if (!agent) {
    return "not configured";
  }

  if (!agent.enabled) {
    return "disabled";
  }

  return isPaused(await context.config.getGlobal()) ? "agents paused" : null;
}

async function openTasks(context: WorkerContext, agentId: string): Promise<ItemRow[]> {
  const currentSprint = (await readCurrentSprint(context.db)) ?? "";
  const rows = await context.db
    .select({ task: localItem })
    .from(localItem)
    .leftJoin(workItem, eq(workItem.adoId, localItem.pbiId)) // tasks without a PBI too (a chat draft's tech-writer task)
    .where(and(eq(localItem.assignee, `agent:${agentId}`), eq(localItem.status, "open")))
    .orderBy(sql`${workItem.iterationPath} = ${currentSprint} DESC NULLS LAST`, sql`${workItem.backlogPriority} ASC NULLS LAST`, asc(localItem.createdAt));

  return rows.map((row) => row.task);
}

// The PBI's Confluence pages are checked when a task on it is about to start (user decision 2026-10-02): a page still
// missing is fetched before the checks, and a valid task's pages are brought to their current version before it runs.
async function tryStart(context: WorkerContext, agent: AgentDefinition, task: ItemRow): Promise<boolean> {
  await syncTaskPages(context, task, "missing");

  const reasons = await validateTask(context.db, task, agent.id, agent.waitFor, agent.capabilities);

  if (reasons.length > 0) {
    await context.db.update(localItem).set({ heldBy: reasons }).where(eq(localItem.id, task.id));

    return false;
  }

  await syncTaskPages(context, task, "all");

  if (!(await claim(context, task))) {
    return false;
  }

  const job: AgentRunJob = { taskId: task.id, agentId: agent.id, pbiId: task.pbiId };

  await context.boss.send(AGENT_RUN_QUEUE, job);

  if (task.pbiId !== null) {
    await syncPipelineStatus(context.db, task.pbiId, ACTOR);
  }

  return true;
}

// Atomic: only an open task is claimed, so two dispatches can't hand out the same task.
async function claim(context: WorkerContext, task: ItemRow): Promise<boolean> {
  const claimed = await context.db
    .update(localItem)
    .set({ status: "in-progress", heldBy: [], updatedAt: new Date() })
    .where(and(eq(localItem.id, task.id), eq(localItem.status, "open")))
    .returning({ id: localItem.id });

  if (claimed.length === 0) {
    return false;
  }

  await setItemStatus(context.db, task.id, "open", "in-progress", ACTOR);

  return true;
}

function batchSize(agent: AgentDefinition): number {
  const value = agent.options.batchSize;

  return typeof value === "number" ? value : 1;
}

async function syncTaskPages(context: WorkerContext, task: ItemRow, which: "missing" | "all"): Promise<void> {
  if (task.pbiId !== null) {
    await syncConfluencePages(context, task.pbiId, which);
  }
}
