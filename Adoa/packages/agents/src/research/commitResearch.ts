import { nextItemId, setItemStatus } from "@adoa/core";
import { agentRun, localItem, type AdoaDb } from "@adoa/db";
import { and, eq, ne } from "drizzle-orm";
import type { QuestionDraft } from "../refinement/models/QuestionDraft";
import type { ResearchTaskDraft } from "../refinement/models/ResearchTaskDraft";
import { commitCaptures } from "../vaultCapture";
import { insertWebResearchTasks } from "../webResearch";
import type { HumanTaskDraft } from "./models/HumanTaskDraft";
import type { ResearchContext } from "./models/ResearchContext";
import type { ResearchDraft } from "./models/ResearchDraft";
import type { ResearchResultOutput } from "./models/ResearchResultOutput";

const ACTOR = "agent:research";

// Writes a successful run: result, follow-ups, web research tasks, human tasks, questions, drafts; closes the task.
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
  const webIds = await insertWebResearchTasks(db, pbi.adoId, runId, task.id, depth, draft.webResearch);
  const outputs = [resultId, ...followUpIds, ...webIds, ...humanIds, ...questionIds, ...captureIds];

  await supersedeEarlierResults(db, task.id, resultId, runId);

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await setItemStatus(db, task.id, "in-progress", "done", ACTOR, runId);

  return outputs;
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

// A re-run task gets a new result; the earlier ones stay for history but no longer count.
async function supersedeEarlierResults(db: AdoaDb, taskId: string, resultId: string, runId: number): Promise<void> {
  const earlier = await db
    .select({ id: localItem.id })
    .from(localItem)
    .where(and(eq(localItem.parentId, taskId), eq(localItem.kind, "research-result"), eq(localItem.status, "final"), ne(localItem.id, resultId)));

  for (const result of earlier) {
    await setItemStatus(db, result.id, "final", "superseded", ACTOR, runId);
  }
}
