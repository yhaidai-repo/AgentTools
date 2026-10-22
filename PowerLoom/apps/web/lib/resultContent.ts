import { agentRun, codeReviewVersion, design, localItem, pbiEstimate, refinement, reviewComment, runResult } from "@powerloom/db";
import { and, asc, eq } from "drizzle-orm";
import type { AgentResult } from "@/models/AgentResult";
import type { ResultKind } from "@/models/ResultKind";
import type { ResultQuestion } from "@/models/ResultQuestion";
import { getDb } from "./db";
import { isResultKind } from "./items";
import { reviewTaskPrId } from "./reviews";

// One version's content, loaded only when it is shown; null when the id isn't a result of that kind.
export async function loadResult(kind: ResultKind, id: string): Promise<AgentResult | null> {
  const loaders: Record<ResultKind, () => Promise<AgentResult | null>> = {
    refinement: () => byNumericId(id, async (rowId) => wrap("refinement", (await getDb().select().from(refinement).where(eq(refinement.id, rowId)))[0])),
    design: () => byNumericId(id, async (rowId) => wrap("design", (await getDb().select().from(design).where(eq(design.id, rowId)))[0])),
    estimate: () => byNumericId(id, async (rowId) => wrap("estimate", (await getDb().select().from(pbiEstimate).where(eq(pbiEstimate.id, rowId)))[0])),
    item: () => loadResultItem(id),
    review: () => byNumericId(id, loadReviewRun),
    run: () => byNumericId(id, async (rowId) => wrap("run", (await getDb().select().from(runResult).where(eq(runResult.id, rowId)))[0])),
  };

  return loaders[kind]();
}

// The PBI and the task a result belongs to: an item answers its parent task, a review run is its task's, a run result
// names both, a version belongs to its run's task.
export async function resultOwner(result: AgentResult): Promise<{ pbiId: number | null; taskId: string | null }> {
  if (result.kind === "item") {
    return { pbiId: result.row.pbiId, taskId: result.row.parentId };
  }

  if (result.kind === "review" || result.kind === "run") {
    return { pbiId: result.row.pbiId, taskId: result.row.taskId };
  }

  return { pbiId: result.row.pbiId, taskId: await taskOfRun(result.row.runId) };
}

async function loadResultItem(id: string): Promise<AgentResult | null> {
  const [row] = await getDb().select().from(localItem).where(eq(localItem.id, id));

  if (!row || !isResultKind(row.kind)) {
    return null;
  }

  return { kind: "item", row, question: row.kind === "research-result" ? await questionOf(row.parentId) : null };
}

// The research task's question and goal, which its result answers (user, 2026-10-21: the goal belongs with the result).
async function questionOf(taskId: string | null): Promise<ResultQuestion | null> {
  if (taskId === null) {
    return null;
  }

  const [task] = await getDb().select({ title: localItem.title, data: localItem.data }).from(localItem).where(eq(localItem.id, taskId));
  const data = (task?.data ?? {}) as { goal?: string; why?: string };

  return task ? { taskId, question: task.title, goal: data.goal ?? data.why ?? null } : null;
}

// A review run of a pull request: its kept version (none before 2026-10-21) and the comments it left.
async function loadReviewRun(runId: number): Promise<AgentResult | null> {
  const [run] = await getDb()
    .select({ taskId: localItem.id, pbiId: localItem.pbiId, data: localItem.data })
    .from(agentRun)
    .innerJoin(localItem, eq(localItem.id, agentRun.itemId))
    .where(and(eq(agentRun.id, runId), eq(localItem.kind, "review")));
  const prId = run ? reviewTaskPrId(run.data) : null;

  if (!run || prId === null) {
    return null;
  }

  const [version] = await getDb().select().from(codeReviewVersion).where(eq(codeReviewVersion.runId, runId));
  const comments = await getDb().select().from(reviewComment).where(eq(reviewComment.runId, runId)).orderBy(asc(reviewComment.id));

  return { kind: "review", row: { id: runId, prId, pbiId: run.pbiId, taskId: run.taskId, version: version ?? null, comments } };
}

async function taskOfRun(runId: number | null): Promise<string | null> {
  if (runId === null) {
    return null;
  }

  const [run] = await getDb().select({ itemId: agentRun.itemId }).from(agentRun).where(eq(agentRun.id, runId));

  return run?.itemId ?? null;
}

function byNumericId(id: string, load: (rowId: number) => Promise<AgentResult | null>): Promise<AgentResult | null> {
  const rowId = Number(id);

  return Number.isInteger(rowId) && rowId > 0 ? load(rowId) : Promise.resolve(null);
}

function wrap<K extends AgentResult["kind"]>(kind: K, row: Extract<AgentResult, { kind: K }>["row"] | undefined): AgentResult | null {
  return row ? ({ kind, row } as AgentResult) : null;
}
