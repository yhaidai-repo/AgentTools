import { nextItemId, setItemStatus, setPbiStatus } from "@adoa/core";
import { agentRun, localItem, workItem, type AdoaDb } from "@adoa/db";
import { and, eq, inArray } from "drizzle-orm";
import type { QuestionDraft } from "../refinement/models/QuestionDraft";
import type { ResearchTaskDraft } from "../refinement/models/ResearchTaskDraft";
import { commitCaptures } from "../vaultCapture";
import type { HumanTaskDraft } from "./models/HumanTaskDraft";
import type { ResearchContext } from "./models/ResearchContext";
import type { ResearchDraft } from "./models/ResearchDraft";
import type { ResearchResultOutput } from "./models/ResearchResultOutput";

const ACTOR = "agent:research";

// Writes a successful run: result, follow-ups, human tasks, questions; closes the task and moves the PBI on.
export async function commitResearch(
  db: AdoaDb,
  context: ResearchContext,
  runId: number,
  draft: ResearchDraft & { result: ResearchResultOutput },
  extra: { commits: Record<string, string>; docsRead: string[] },
): Promise<string[]> {
  const { task, pbi } = context;
  const depth = Number((task.data as { depth?: number } | null)?.depth ?? 1);
  const resultId = await insertItem(db, "RR", "research-result", context, runId, `Result: ${task.title}`, "final", draft.result.conclusion, { ...draft.result, ...extra });
  const followUpIds = await insertFollowUps(db, context, runId, draft.followUps, depth + 1);
  const humanIds = await insertHumanTasks(db, context, runId, draft.humanTasks);
  const questionIds = await insertQuestions(db, context, runId, draft.questions);
  const captureIds = await commitCaptures(db, runId, pbi.adoId, task.id, draft.captures);
  const outputs = [resultId, ...followUpIds, ...humanIds, ...questionIds, ...captureIds];

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await setItemStatus(db, task.id, "in-progress", "done", ACTOR, runId);
  await moveResearchedPbi(db, pbi.adoId, runId);

  return outputs;
}

// All research of the PBI done or cancelled → ready-for-design; a blocked task keeps the PBI waiting.
export async function moveResearchedPbi(db: AdoaDb, adoId: number, runId?: number): Promise<void> {
  const remaining = await db
    .select({ id: localItem.id, status: localItem.status })
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), eq(localItem.kind, "research"), inArray(localItem.status, ["open", "in-progress", "blocked"])));
  const [pbi] = await db.select({ status: workItem.pipelineStatus }).from(workItem).where(eq(workItem.adoId, adoId));
  const next = nextResearchStatus(remaining.map((item) => item.status));

  if (pbi && pbi.status !== next && ["needs-research", "researching"].includes(pbi.status)) {
    await setPbiStatus(db, adoId, pbi.status, next, ACTOR, runId);
  }
}

function nextResearchStatus(openStatuses: string[]): "ready-for-design" | "researching" | "needs-research" {
  if (openStatuses.length === 0) {
    return "ready-for-design";
  }

  return openStatuses.includes("in-progress") ? "researching" : "needs-research";
}

async function insertFollowUps(db: AdoaDb, context: ResearchContext, runId: number, tasks: ResearchTaskDraft[], depth: number): Promise<string[]> {
  const ids: string[] = [];

  for (const task of tasks) {
    ids.push(await insertItem(db, "AT", "research", context, runId, task.title, "open", task.question, { goal: task.goal, repos: task.repos, depth }, "agent:research"));
  }

  return ids;
}

async function insertHumanTasks(db: AdoaDb, context: ResearchContext, runId: number, tasks: HumanTaskDraft[]): Promise<string[]> {
  const ids: string[] = [];

  for (const task of tasks) {
    ids.push(await insertItem(db, "HT", "human", context, runId, task.title, "open", task.description, null, "human"));
  }

  return ids;
}

async function insertQuestions(db: AdoaDb, context: ResearchContext, runId: number, questions: QuestionDraft[]): Promise<string[]> {
  const ids: string[] = [];

  for (const question of questions) {
    ids.push(await insertItem(db, "Q", "question", context, runId, question.question.slice(0, 120), "open", question.question, { why: question.why, options: question.options }, "human"));
  }

  return ids;
}

async function insertItem(
  db: AdoaDb,
  prefix: "AT" | "HT" | "Q" | "RR",
  kind: typeof localItem.$inferInsert.kind,
  context: ResearchContext,
  runId: number,
  title: string,
  status: typeof localItem.$inferInsert.status,
  body: string,
  data: object | null,
  assignee = ACTOR,
): Promise<string> {
  const id = await nextItemId(db, prefix, context.pbi.adoId);

  await db.insert(localItem).values({ id, kind, pbiId: context.pbi.adoId, parentId: context.task.id, title, status, assignee, body, data, createdByRun: runId });

  return id;
}
