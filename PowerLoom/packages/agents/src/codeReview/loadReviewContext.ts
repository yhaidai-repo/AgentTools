import { topLevelPbi } from "@powerloom/core";
import { design, pullRequest, refinement, reviewComment, workItem, type PowerLoomDb } from "@powerloom/db";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import type { RepoRef } from "@agenttools/runtime";
import type { LinkedPbi } from "./models/LinkedPbi";
import type { ReviewContext } from "./models/ReviewContext";

type PullRequestRow = typeof pullRequest.$inferSelect;

export async function loadPullRequest(db: PowerLoomDb, prId: number): Promise<PullRequestRow> {
  const [pr] = await db.select().from(pullRequest).where(eq(pullRequest.id, prId));

  if (!pr) {
    throw new Error(`pull request ${prId} isn't in PowerLoom; the pull-requests job adds it`);
  }

  return pr;
}

// The pull request with its repo (opened like any agent's repo), the comments earlier runs left (withdrawn and fixed ones
// are done with) and the work items the PR links.
export async function loadReviewContext(db: PowerLoomDb, pr: PullRequestRow, repo: RepoRef): Promise<ReviewContext> {
  return {
    pr,
    repo,
    earlierComments: await db.select().from(reviewComment).where(and(eq(reviewComment.prId, pr.id), notInArray(reviewComment.status, ["withdrawn", "fixed"]))).orderBy(reviewComment.id),
    linkedPbis: await loadLinkedPbis(db, pr.workItemIds),
  };
}

async function loadLinkedPbis(db: PowerLoomDb, adoIds: number[]): Promise<LinkedPbi[]> {
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
async function topLevelParent(db: PowerLoomDb, adoId: number): Promise<LinkedPbi["parent"]> {
  const parent = await topLevelPbi(db, adoId);

  return parent && parent.adoId !== adoId ? { adoId: parent.adoId, title: parent.title } : null;
}

async function latestRefinementSummary(db: PowerLoomDb, adoId: number): Promise<string | null> {
  const [row] = await db.select({ summary: refinement.summary }).from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);

  return row?.summary ?? null;
}

async function latestDesignApproach(db: PowerLoomDb, adoId: number): Promise<string | null> {
  const [row] = await db.select({ approach: design.approach }).from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1);

  return row?.approach || null;
}
