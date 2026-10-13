import { ANY_AGENT, nextGlobalItemId, nextItemId, renderHumanTaskBody, vaultOfPbiSql } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { and, count, eq, isNotNull, like } from "drizzle-orm";
import type { ActualizeTaskData } from "../techWriter/models/ActualizeTaskData";
import type { CreatedTask } from "./models/CreatedTask";
import type { TaskCommitContext } from "./models/TaskCommitContext";
import type { TaskTarget } from "./models/TaskTarget";
import { USER, targetOf } from "./taskTargets";

const NEW_TASK = /^new:(\d+)$/;
const USER_ASSIGNEE = "human";

// Writes a successful run's created tasks in order, so a `new:<n>` dependency points at an id written before it.
export async function commitCreatedTasks(db: PowerLoomDb, context: TaskCommitContext, tasks: CreatedTask[]): Promise<string[]> {
  const ids: string[] = [];

  for (const task of tasks) {
    ids.push(await insertTask(db, context, { ...task, dependsOn: resolveDependencies(task.dependsOn, ids) }));
  }

  return ids;
}

// Agent tasks that agents created on the PBI so far: the per-PBI cap counts them across runs.
export async function countAgentCreatedTasks(db: PowerLoomDb, pbiId: number): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(localItem)
    .where(and(eq(localItem.pbiId, pbiId), isNotNull(localItem.createdByRun), like(localItem.assignee, "agent:%")));

  return Number(row?.total ?? 0);
}

function resolveDependencies(dependsOn: string[], written: string[]): string[] {
  return dependsOn.map((id) => {
    const created = NEW_TASK.exec(id);

    return created ? written[Number(created[1]) - 1] : id;
  });
}

function insertTask(db: PowerLoomDb, context: TaskCommitContext, task: CreatedTask): Promise<string> {
  if (task.assignee === USER) {
    return task.kind === "question" ? insertQuestion(db, context, task) : insertUserTask(db, context, task);
  }

  const target = targetOf(task.assignee)!;

  return target.scope === "global" ? insertDocsTask(db, context, task, target) : insertAgentTask(db, context, task, target);
}

// `goal` in data is what the research message shows as the task's goal, so it carries the done-when.
async function insertAgentTask(db: PowerLoomDb, context: TaskCommitContext, task: CreatedTask, target: TaskTarget): Promise<string> {
  const id = await nextItemId(db, target.prefix as "AT" | "DT", context.pbiId);
  const data = { ...decisionData(task), goal: task.doneWhen, doneWhen: task.doneWhen, outOfScope: task.outOfScope, effort: task.effort, depth: context.depth + 1 };

  await db.insert(localItem).values({ ...pbiItem(context, id), kind: target.kind, title: task.title, status: "open", assignee: ANY_AGENT, body: task.goal, data });

  return id;
}

// Like the vault review's actualize tasks: numbered across the app and kept off the PBI, so a doc fix never holds it.
async function insertDocsTask(db: PowerLoomDb, context: TaskCommitContext, task: CreatedTask, target: TaskTarget): Promise<string> {
  const id = await nextGlobalItemId(db, "WT");
  const path = task.docPath!;
  const data: ActualizeTaskData = {
    key: `actualize:${context.docsVault}:${path}:RUN-${context.runId}`,
    mode: "actualize",
    vault: context.docsVault,
    path,
    project: path.split("/")[0],
    reasons: `${task.goal}\n\nWhy: ${task.reason}`,
    suspectFacts: task.evidence.map((item) => `${item.ref}: ${item.note}`),
    reviewTask: context.parentTaskId,
  };

  await db.insert(localItem).values({
    id, kind: target.kind, pbiId: null, vault: context.docsVault, parentId: context.parentTaskId, title: task.title, status: "open", assignee: ANY_AGENT, body: task.goal, data: { ...data, ...decisionData(task) }, createdByRun: context.runId,
  });

  return id;
}

async function insertUserTask(db: PowerLoomDb, context: TaskCommitContext, task: CreatedTask): Promise<string> {
  const id = await nextItemId(db, "HT", context.pbiId);
  const human = { why: task.reason, solves: task.goal, steps: task.steps };

  await db.insert(localItem).values({ ...pbiItem(context, id), kind: "human", title: task.title, status: "open", assignee: USER_ASSIGNEE, body: renderHumanTaskBody(human), data: { ...human, ...decisionData(task) } });

  return id;
}

async function insertQuestion(db: PowerLoomDb, context: TaskCommitContext, task: CreatedTask): Promise<string> {
  const id = await nextItemId(db, "Q", context.pbiId);
  const data = { why: task.reason, options: task.options, doneWhen: task.doneWhen, ...decisionData(task) };

  await db.insert(localItem).values({ ...pbiItem(context, id), kind: "question", title: task.title, status: "open", assignee: USER_ASSIGNEE, body: task.goal, data });

  return id;
}

function pbiItem(context: TaskCommitContext, id: string) {
  return { id, pbiId: context.pbiId, vault: vaultOfPbiSql(context.pbiId), parentId: context.parentTaskId, createdByRun: context.runId };
}

// Why the task exists and what it holds: kept on every created item (framework P9; Ready for dev reads `blocking`).
function decisionData(task: CreatedTask) {
  return { reason: task.reason, evidence: task.evidence, blocking: task.blocking, dependsOn: task.dependsOn };
}
