import { nextItemId, setPbiStatus } from "@adoa/core";
import { agentRun, localItem, refinement, workItem, type AdoaDb } from "@adoa/db";
import { eq, max } from "drizzle-orm";
import { linkedDocuments } from "../links";
import type { LinkedDocument } from "../models/LinkedDocument";
import type { QuestionDraft } from "./models/QuestionDraft";
import type { RefinementDraft } from "./models/RefinementDraft";
import type { RefinementOutput } from "./models/RefinementOutput";
import type { ResearchTaskDraft } from "./models/ResearchTaskDraft";

const ACTOR = "agent:refinement";

// Writes a successful run's draft: refinement version, research tasks, questions (incl. repo confirmation),
// then moves the PBI on. Returns the ids of everything created, for the run's outputs.
export async function commitRefinement(db: AdoaDb, adoId: number, runId: number, draft: RefinementDraft & { refinement: RefinementOutput }, docsRead: string[]): Promise<string[]> {
  const version = await insertRefinement(db, adoId, runId, draft.refinement, docsRead);
  const taskIds = await insertResearchTasks(db, adoId, runId, draft.researchTasks);
  const [pbi] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));
  const questions = [...withRepoConfirmation(adoId, draft), ...(await linkQuestions(db, adoId, draft.questions, pbi ? linkedDocuments(pbi) : []))];
  const questionIds = await insertQuestions(db, adoId, runId, questions);
  const outputs = [`PBI-${adoId}-refinement v${version}`, ...taskIds, ...questionIds];

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await setPbiStatus(db, adoId, "refining", taskIds.length > 0 ? "needs-research" : "ready-for-design", ACTOR, runId);

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

// Guard, not prompt: every linked document the agent couldn't read and no question mentions gets its own question.
async function linkQuestions(db: AdoaDb, adoId: number, drafts: QuestionDraft[], links: LinkedDocument[]): Promise<QuestionDraft[]> {
  const existing = await db.select({ body: localItem.body }).from(localItem).where(eq(localItem.pbiId, adoId));
  const asked = [...existing.map((item) => item.body ?? ""), ...drafts.map((draft) => draft.question)].join("\n");
  const missing = links.filter((link) => link.kind !== "ado-attachment" && !asked.includes(link.url));

  return missing.map((link) => ({
    question: `Provide the content of the linked ${link.kind === "confluence" ? "Confluence page" : "document"}: ${link.url}`,
    why: "The PBI links it, but agents cannot open it, so its content is missing from refinement and research. Paste the relevant part into the PBI note's Notes section or the docs vault.",
    options: ["Paste content into the PBI note (Notes)", "Add it to the docs vault", "Not needed"],
  }));
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
