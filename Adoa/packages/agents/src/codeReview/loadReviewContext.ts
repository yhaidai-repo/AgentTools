import { topLevelPbi, type ReviewTaskData } from "@adoa/core";
import { design, pullRequest, refinement, reviewComment, workItem, type AdoaDb } from "@adoa/db";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { reposByName } from "../research/resolveRepos";
import type { LinkedPbi } from "./models/LinkedPbi";
import type { ReviewContext } from "./models/ReviewContext";

// The task's pull request with its repo from the catalog (cloned like any agent's repo), the comments earlier runs left
// (withdrawn ones are done with) and the work items the PR links.
export async function loadReviewContext(db: AdoaDb, data: ReviewTaskData): Promise<ReviewContext> {
  const [pr] = await db.select().from(pullRequest).where(eq(pullRequest.id, data.prId));

  if (!pr) {
    throw new Error(`pull request ${data.prId} isn't in adoa; the pull-requests job adds it`);
  }

  const { repos } = await reposByName(db, pr.vault, [pr.repoName]);

  if (repos.length === 0) {
    throw new Error(`repo "${pr.repoName}" isn't among the vault's enabled repositories; the sync refreshes the catalog`);
  }

  return {
    pr,
    repo: repos[0],
    earlierComments: await db.select().from(reviewComment).where(and(eq(reviewComment.prId, pr.id), ne(reviewComment.status, "withdrawn"))).orderBy(reviewComment.id),
    linkedPbis: await loadLinkedPbis(db, pr.workItemIds),
  };
}

async function loadLinkedPbis(db: AdoaDb, adoIds: number[]): Promise<LinkedPbi[]> {
  const known = adoIds.length > 0 ? await db.select({ adoId: workItem.adoId, title: workItem.title }).from(workItem).where(inArray(workItem.adoId, adoIds)) : [];
  const titles = new Map(known.map((row) => [row.adoId, row.title]));

  return Promise.all(adoIds.map(async (adoId) => ({
    adoId,
    title: titles.get(adoId) ?? null,
    refinementSummary: titles.has(adoId) ? await latestRefinementSummary(db, adoId) : null,
    designApproach: titles.has(adoId) ? await latestDesignApproach(db, adoId) : null,
    parent: titles.has(adoId) ? await topLevelParent(db, adoId) : null,
  })));
}

// The PBI a child item is filed under; null for a top-level PBI.
async function topLevelParent(db: AdoaDb, adoId: number): Promise<LinkedPbi["parent"]> {
  const parent = await topLevelPbi(db, adoId);

  return parent && parent.adoId !== adoId ? { adoId: parent.adoId, title: parent.title } : null;
}

async function latestRefinementSummary(db: AdoaDb, adoId: number): Promise<string | null> {
  const [row] = await db.select({ summary: refinement.summary }).from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);

  return row?.summary ?? null;
}

async function latestDesignApproach(db: AdoaDb, adoId: number): Promise<string | null> {
  const [row] = await db.select({ approach: design.approach }).from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1);

  return row?.approach || null;
}
