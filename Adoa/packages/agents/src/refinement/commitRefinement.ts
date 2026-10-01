import { nextItemId } from "@adoa/core";
import { agentRun, localItem, refinement, type AdoaDb } from "@adoa/db";
import { eq, max } from "drizzle-orm";
import type { QuestionDraft } from "./models/QuestionDraft";
import type { RefinementDraft } from "./models/RefinementDraft";
import type { RefinementOutput } from "./models/RefinementOutput";
import type { ResearchTaskDraft } from "./models/ResearchTaskDraft";

// Writes a successful run's draft: refinement version, research tasks, questions (incl. repo confirmation).
// Returns the ids of everything created, for the run's outputs. Ending the task and the PBI status follow from the tasks.
export async function commitRefinement(db: AdoaDb, adoId: number, runId: number, draft: RefinementDraft & { refinement: RefinementOutput }, docsRead: string[]): Promise<string[]> {
  const version = await insertRefinement(db, adoId, runId, draft.refinement, docsRead);
  const taskIds = await insertResearchTasks(db, adoId, runId, draft.researchTasks);
  const questionIds = await insertQuestions(db, adoId, runId, withRepoConfirmation(adoId, draft));
  const outputs = [`PBI-${adoId}-refinement v${version}`, ...taskIds, ...questionIds];

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));

  return outputs;
}

async function insertRefinement(db: AdoaDb, adoId: number, runId: number, output: RefinementOutput, docsRead: string[]): Promise<number> {
  const [{ latest }] = await db.select({ latest: max(refinement.version) }).from(refinement).where(eq(refinement.pbiId, adoId));
  const version = (latest ?? 0) + 1;

  await db.insert(refinement).values({ pbiId: adoId, version, runId, ...output, docsRead });

  return version;
}

async function insertResearchTasks(db: AdoaDb, adoId: number, runId: number, tasks: ResearchTaskDraft[]): Promise<string[]> {
  const ids: string[] = [];

  for (const task of tasks) {
    const id = await nextItemId(db, "AT", adoId);

    await db.insert(localItem).values({
      id, kind: "research", pbiId: adoId, title: task.title, status: "open", assignee: "agent:research",
      body: task.question, data: { goal: task.goal, repos: task.repos, depth: 1 }, createdByRun: runId,
    });
    ids.push(id);
  }

  return ids;
}

async function insertQuestions(db: AdoaDb, adoId: number, runId: number, questions: QuestionDraft[]): Promise<string[]> {
  const ids: string[] = [];

  for (const question of questions) {
    const id = await nextItemId(db, "Q", adoId);

    await db.insert(localItem).values({
      id, kind: "question", pbiId: adoId, title: question.question.slice(0, 120), status: "open", assignee: "human",
      body: question.question, data: { why: question.why, options: question.options }, createdByRun: runId,
    });
    ids.push(id);
  }

  return ids;
}

// The agent guesses the repos; the user confirms them (user decision 2026-09-27).
function withRepoConfirmation(adoId: number, draft: RefinementDraft & { refinement: RefinementOutput }): QuestionDraft[] {
  const repos = draft.refinement.repos.map((choice) => choice.name);

  if (repos.length === 0) {
    return draft.questions;
  }

  return [
    ...draft.questions,
    { question: `Confirm repos for PBI-${adoId}: ${repos.join(", ")}`, why: "Research and design clone only these repos.", options: ["Confirm", "Correct the list"] },
  ];
}
