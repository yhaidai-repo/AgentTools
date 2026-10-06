import { nextItemId, recommendPbiSkills, vaultOfPbiSql } from "@adoa/core";
import { agentRun, localItem, refinement, type AdoaDb } from "@adoa/db";
import { eq, max } from "drizzle-orm";
import { commitRelevantPages } from "../relevantPages";
import { commitCaptures } from "../vaultCapture";
import { insertWebResearchTasks } from "../webResearch";
import { confirmRepos } from "./confirmRepos";
import { insertQuestions } from "./insertQuestions";
import type { RefinementDraft } from "./models/RefinementDraft";
import type { RefinementOutput } from "./models/RefinementOutput";
import type { ResearchTaskDraft } from "./models/ResearchTaskDraft";

// Writes a successful run's draft: refinement version, research tasks, questions (incl. repo confirmation), vault drafts, and the
// recommended skills for the PBI (unless the user already saved its list).
// Returns the ids of everything created, for the run's outputs. Ending the task and the PBI status follow from the tasks.
// `documented`: the repos vault projects name (see documentedRepos), which need no confirmation.
export async function commitRefinement(db: AdoaDb, adoId: number, runId: number, draft: RefinementDraft & { refinement: RefinementOutput }, docsRead: string[], documented: Map<string, string>): Promise<string[]> {
  const version = await insertRefinement(db, adoId, runId, draft.refinement, docsRead);
  const taskIds = await insertResearchTasks(db, adoId, runId, draft.researchTasks);
  const questionIds = await insertQuestions(db, adoId, runId, draft.questions);
  const repoQuestionIds = await confirmRepos(db, adoId, runId, draft.refinement.repos.map((choice) => choice.name), documented);
  const webIds = await insertWebResearchTasks(db, adoId, runId, null, 1, draft.webResearch);
  const captureIds = await commitCaptures(db, runId, adoId, null, draft.captures);
  const outputs = [`PBI-${adoId}-refinement v${version}`, ...taskIds, ...webIds, ...questionIds, ...repoQuestionIds, ...captureIds];

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));
  await recommendPbiSkills(db, adoId, draft.refinement.skills);
  await commitRelevantPages(db, adoId, draft.pages, "refinement");

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
      id, kind: "research", pbiId: adoId, vault: vaultOfPbiSql(adoId), title: task.title, status: "open", assignee: "agent:research",
      body: task.question, data: { goal: task.goal, repos: task.repos, depth: 1 }, createdByRun: runId,
    });
    ids.push(id);
  }

  return ids;
}
