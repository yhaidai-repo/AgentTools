import { ANY_AGENT, handoffHumanTaskBody, handoffQuestionBody, insertHandoff, nextGlobalItemId, nextItemId, nextScopedItemId, renderHumanTaskBody, vaultOfPbiSql, type HumanTaskData, type ItemPrefix, type NewHandoff } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { and, count, eq, isNotNull, like } from "drizzle-orm";
import type { ActualizeTaskData } from "../techWriter/models/ActualizeTaskData";
import type { CreatedTask } from "./models/CreatedTask";
import type { TaskCommitContext } from "./models/TaskCommitContext";
import type { TaskTarget } from "./models/TaskTarget";
import { USER, targetOf } from "./taskTargets";
import { normalizeNotePath, notePathProblem } from "../techWriter/notePaths";

const NEW_TASK = /^new:(\d+)$/;
const USER_ASSIGNEE = "human";

// Writes a successful run's created tasks in order, so a `new:<n>` dependency points at an id written before it. A task
// hand_off made gets its hand-off recorded with it.
export async function commitCreatedTasks(db: PowerLoomDb, context: TaskCommitContext, tasks: CreatedTask[]): Promise<string[]> {
  const ids: string[] = [];

  for (const task of tasks) {
    ids.push(await commitTask(db, context, resolveTask(task, ids)));
  }

  return ids;
}

// The task with every `new:<n>` it names (its dependencies, its hand-off's items) replaced by the id written for it.
export function resolveTask(task: CreatedTask, written: readonly string[]): CreatedTask {
  const dependsOn = resolveTaskDependencies(task.dependsOn, written);

  if (!task.handoff) {
    return { ...task, dependsOn };
  }

  const refs = { ...task.handoff.package.refs, items: resolveTaskDependencies(task.handoff.package.refs.items, written) };

  return { ...task, dependsOn, handoff: { ...task.handoff, package: { ...task.handoff.package, refs } } };
}

async function commitTask(db: PowerLoomDb, context: TaskCommitContext, task: CreatedTask): Promise<string> {
  const id = await insertTask(db, context, task);

  if (task.handoff) {
    await insertHandoff(db, newHandoffOf(context, task), id);
  }

  return id;
}

// Agent tasks that agents created on the PBI so far: the per-PBI cap counts them across runs.
export async function countAgentCreatedTasks(db: PowerLoomDb, pbiId: number): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(localItem)
    .where(and(eq(localItem.pbiId, pbiId), isNotNull(localItem.createdByRun), like(localItem.assignee, "agent:%")));

  return Number(row?.total ?? 0);
}

export function resolveTaskDependencies(dependsOn: readonly string[], written: readonly string[]): string[] {
  return dependsOn.map((id) => {
    if (typeof id !== "string" || !id.trim()) throw new Error("Task dependency must be a non-empty ID");
    const created = NEW_TASK.exec(id);
    if (!id.startsWith("new:")) return id;
    const index = created ? Number(created[1]) : 0;
    const resolved = Number.isSafeInteger(index) && index > 0 ? written[index - 1] : undefined;
    if (typeof resolved !== "string" || !resolved.trim()) throw new Error(`Unresolved task dependency: ${id}; only earlier-created tasks may be referenced`);
    return resolved;
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
  const id = await nextId(db, target.prefix as ItemPrefix, context.pbiId);
  const data = { ...decisionData(task), ...reposData(context), goal: task.doneWhen, depth: context.depth + 1 };

  await db.insert(localItem).values({ ...pbiItem(context, id), kind: target.kind, title: task.title, status: "open", assignee: ANY_AGENT, body: task.goal, data });

  return id;
}

// Like the vault review's actualize tasks: numbered across the app and kept off the PBI, so a doc fix never holds it.
async function insertDocsTask(db: PowerLoomDb, context: TaskCommitContext, task: CreatedTask, target: TaskTarget): Promise<string> {
  if (!task.docPath) throw new Error("Docs task needs a note path.");
  const path = normalizeNotePath(task.docPath);
  const problem = notePathProblem(path);
  if (problem) throw new Error(problem);
  const id = await nextGlobalItemId(db, "WT");
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
  const id = await nextId(db, "HT", context.pbiId);
  const human = { why: task.reason, solves: task.goal, steps: task.steps };

  await db.insert(localItem).values({ ...pbiItem(context, id), kind: "human", title: task.title, status: "open", assignee: USER_ASSIGNEE, body: humanTaskBodyOf(context, task, human), data: { ...human, ...decisionData(task) } });

  return id;
}

async function insertQuestion(db: PowerLoomDb, context: TaskCommitContext, task: CreatedTask): Promise<string> {
  const id = await nextId(db, "Q", context.pbiId);
  const data = { why: task.reason, options: task.options, ...decisionData(task) };

  await db.insert(localItem).values({ ...pbiItem(context, id), kind: "question", title: task.title, status: "open", assignee: USER_ASSIGNEE, body: questionBodyOf(context, task), data });

  return id;
}

// A person's item shows the hand-off's package with it, rendered as the agents read it.
function humanTaskBodyOf(context: TaskCommitContext, task: CreatedTask, human: HumanTaskData): string {
  const criteria = [`## Done when\n\n${task.doneWhen}`, ...(task.outOfScope ? [`## Out of scope\n\n${task.outOfScope}`] : [])].join("\n\n");

  return task.handoff ? handoffHumanTaskBody(newHandoffOf(context, task), human, criteria) : `${renderHumanTaskBody(human)}\n\n${criteria}`;
}

function questionBodyOf(context: TaskCommitContext, task: CreatedTask): string {
  return task.handoff ? handoffQuestionBody(newHandoffOf(context, task), task.goal) : task.goal;
}

// The hand-off a task carries, sent by the creating task's run.
function newHandoffOf(context: TaskCommitContext, task: CreatedTask): NewHandoff {
  const handoff = task.handoff!;

  return { from: { taskId: context.parentTaskId, agent: context.agent, runId: context.runId }, toKind: targetKindOf(task), intent: handoff.intent, gate: handoff.gate, package: handoff.package };
}

function targetKindOf(task: CreatedTask): NewHandoff["toKind"] {
  if (task.assignee !== USER) {
    return "agent";
  }

  return task.kind === "question" ? "question" : "human";
}

// A task without a PBI names its own repos (the Tasks page's choice); one an agent creates inherits its run's.
function reposData(context: TaskCommitContext): { repos?: string[] } {
  return context.pbiId === null ? { repos: context.repos ?? [] } : {};
}

function pbiItem(context: TaskCommitContext, id: string) {
  return { id, pbiId: context.pbiId, vault: context.pbiId === null ? context.vault : vaultOfPbiSql(context.pbiId), parentId: context.parentTaskId, createdByRun: context.runId };
}

// Per PBI (`AT-36756-002`), or across the app for a task without one (`AT-004`), as access requests do.
export function nextId(db: PowerLoomDb, prefix: ItemPrefix, pbiId: number | null): Promise<string> {
  return pbiId === null ? nextScopedItemId(db, `${prefix}-`) : nextItemId(db, prefix, pbiId);
}

// Why the task exists and what it holds: kept on every created item (framework P9; Ready for dev reads `blocking`).
function decisionData(task: CreatedTask) {
  return { reason: task.reason, evidence: task.evidence, blocking: task.blocking, dependsOn: task.dependsOn, doneWhen: task.doneWhen, outOfScope: task.outOfScope, effort: task.effort };
}
