import { hasItemWithKey, nextItemId, recommendPbiSkills, repoConfirmationKey, setItemStatus } from "@adoa/core";
import { agentRun, localItem, refinement, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, like, max, ne, sql } from "drizzle-orm";
import { insertWebResearchTasks } from "../webResearch";
import type { QuestionDraft } from "./models/QuestionDraft";
import type { RefinementDraft } from "./models/RefinementDraft";
import type { RefinementOutput } from "./models/RefinementOutput";
import type { ResearchTaskDraft } from "./models/ResearchTaskDraft";

const ACTOR = "agent:refinement";

// Writes a successful run's draft: refinement version, research tasks, questions (incl. repo confirmation), and the
// recommended skills for the PBI (unless the user already saved its list).
// Returns the ids of everything created, for the run's outputs. Ending the task and the PBI status follow from the tasks.
export async function commitRefinement(db: AdoaDb, adoId: number, runId: number, draft: RefinementDraft & { refinement: RefinementOutput }, docsRead: string[]): Promise<string[]> {
  const version = await insertRefinement(db, adoId, runId, draft.refinement, docsRead);
  const taskIds = await insertResearchTasks(db, adoId, runId, draft.researchTasks);
  const questionIds = await insertQuestions(db, adoId, runId, draft.questions);
  const repoQuestionIds = await confirmRepos(db, adoId, runId, draft.refinement.repos.map((choice) => choice.name));
  const webIds = await insertWebResearchTasks(db, adoId, runId, null, 1, draft.webResearch);
  const outputs = [`PBI-${adoId}-refinement v${version}`, ...taskIds, ...webIds, ...questionIds, ...repoQuestionIds];

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await recommendPbiSkills(db, adoId, draft.refinement.skills);

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

async function insertQuestions(db: AdoaDb, adoId: number, runId: number, questions: QuestionDraft[], key?: string): Promise<string[]> {
  const ids: string[] = [];

  for (const question of questions) {
    const id = await nextItemId(db, "Q", adoId);

    await db.insert(localItem).values({
      id, kind: "question", pbiId: adoId, title: question.question.slice(0, 120), status: "open", assignee: "human",
      body: question.question, data: { why: question.why, options: question.options, ...(key ? { key } : {}) }, createdByRun: runId,
    });
    ids.push(id);
  }

  return ids;
}

// The agent guesses the repos; the user confirms them (user decision 2026-09-27). Asked once per repo list (item key);
// a different list replaces the still-open question about the earlier one.
async function confirmRepos(db: AdoaDb, adoId: number, runId: number, repos: string[]): Promise<string[]> {
  const key = repoConfirmationKey(repos);

  if (repos.length === 0 || (await hasItemWithKey(db, adoId, key))) {
    return [];
  }

  const question: QuestionDraft = { question: `Confirm repos for PBI-${adoId}: ${repos.join(", ")}`, why: "Research and design clone only these repos.", options: ["Confirm", "Correct the list"] };
  const ids = await insertQuestions(db, adoId, runId, [question], key);

  await replaceOpenRepoQuestions(db, adoId, ids[0], runId);

  return ids;
}

async function replaceOpenRepoQuestions(db: AdoaDb, adoId: number, newId: string, runId: number): Promise<void> {
  const older = await db
    .select({ id: localItem.id })
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), ne(localItem.id, newId), inArray(localItem.status, ["open", "in-progress"]), like(sql`${localItem.data}->>'key'`, "repos:%")));

  for (const question of older) {
    await db.update(localItem).set({ resolution: `Replaced by ${newId} (the repo list changed).` }).where(eq(localItem.id, question.id));
    await setItemStatus(db, question.id, "open", "dismissed", ACTOR, runId);
  }
}
