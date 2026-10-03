import type { AdoClient, AdoPullRequest } from "@adoa/ado";
import { closeReview, finishRun, isAdoConfigured, readAdoSettings, readPullRequestSettings, startRun } from "@adoa/core";
import { codeReview, pullRequest, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { createAdoClient } from "../adoClient";
import type { WorkerContext } from "../models/WorkerContext";

type PullRequestRow = typeof pullRequest.$inferSelect;

const ACTOR = "pull-requests";
const UNLISTED_REASON = "The PR was completed or abandoned in Azure DevOps, or you're no longer a reviewer.";
const REPO_NOT_SELECTED_REASON = "Its repo isn't selected for code review in Settings.";

// The pull-requests job (user decision 2026-10-02): mirrors the active ADO pull requests the Settings user reviews. A new
// one gets a review, not reviewed yet: the user starts each review on the Reviews page (user decision 2026-10-02, replaces
// "a review task per new PR"); a new push only updates the mirror; one that left the list closes its review. Recorded as
// a run of stage pull-requests.
export async function syncPullRequests(context: WorkerContext): Promise<string> {
  const runId = await startRun(context.db, "pull-requests");

  try {
    const message = await syncListed(context.db);

    await finishRun(context.db, runId, "success", null);

    return message;
  } catch (error) {
    await finishRun(context.db, runId, "failed", (error as Error).message);
    throw error;
  }
}

async function syncListed(db: AdoaDb): Promise<string> {
  const ado = await readAdoSettings(db);

  if (!isAdoConfigured(ado)) {
    throw new Error("ADO settings are not configured");
  }

  const client = await createAdoClient(db);
  const { maxPullRequestsPerRun, repos } = await readPullRequestSettings(db);
  const mine = (await client.listActivePullRequests()).filter((pr) => isReviewer(pr, ado.user) && !isAuthor(pr, ado.user) && pr.sourceCommit);
  const listed = mine.filter((pr) => isSelectedRepo(pr, repos));
  const changed = await changedPullRequests(db, listed);
  const updated = changed.slice(0, maxPullRequestsPerRun);

  for (const pr of updated) {
    await upsertPullRequest(db, client, pr);
  }

  await markListed(db, listed);

  const added = await addNewReviews(db, listed);
  const closed = await closeUnlisted(db, listed, mine);
  const waiting = changed.length - updated.length;
  const notSelected = mine.length - listed.length;

  return `${listed.length} PR(s) you review${notSelected > 0 ? ` (${notSelected} more in repos not selected)` : ""}, ${updated.length} updated${waiting > 0 ? ` (${waiting} next run)` : ""}, ${added} new review(s), ${closed} closed`;
}

// Only you by name counts, not a team you're in (assumption, 2026-10-02).
function isReviewer(pr: AdoPullRequest, user: string): boolean {
  return pr.reviewers.some((reviewer) => reviewer.toLowerCase() === user.toLowerCase());
}

// The repos chosen in Settings (user decision 2026-10-02); none chosen = every repo.
function isSelectedRepo(pr: AdoPullRequest, repos: string[]): boolean {
  return repos.length === 0 || repos.some((repo) => repo.toLowerCase() === pr.repoName.toLowerCase());
}

// ADO can list the author among the reviewers (branch policies); your own PRs aren't yours to review (user decision 2026-10-02).
function isAuthor(pr: AdoPullRequest, user: string): boolean {
  return pr.author?.toLowerCase() === user.toLowerCase();
}

// New PRs and PRs with a new push need their details (pushes, linked work items); the rest are unchanged.
async function changedPullRequests(db: AdoaDb, listed: AdoPullRequest[]): Promise<AdoPullRequest[]> {
  const known = await knownPullRequests(db, listed.map((pr) => pr.id));

  return listed.filter((pr) => known.get(pr.id)?.sourceCommit !== pr.sourceCommit || known.get(pr.id)?.isDraft !== pr.isDraft);
}

async function knownPullRequests(db: AdoaDb, ids: number[]): Promise<Map<number, PullRequestRow>> {
  const rows = ids.length > 0 ? await db.select().from(pullRequest).where(inArray(pullRequest.id, ids)) : [];

  return new Map(rows.map((row) => [row.id, row]));
}

async function upsertPullRequest(db: AdoaDb, client: AdoClient, pr: AdoPullRequest): Promise<void> {
  const details = await client.getPullRequestDetails(pr.repoId, pr.id);
  const values = {
    repoId: pr.repoId,
    repoName: pr.repoName,
    title: pr.title,
    descriptionMd: pr.description,
    author: pr.author,
    sourceRef: pr.sourceRef,
    targetRef: pr.targetRef,
    sourceCommit: pr.sourceCommit!,
    targetCommit: pr.targetCommit,
    iteration: details.iteration,
    isDraft: pr.isDraft,
    workItemIds: details.workItemIds,
    url: pr.url,
    isListed: true,
    adoCreatedAt: pr.createdAt ? new Date(pr.createdAt) : null,
    syncedAt: new Date(),
  };

  await db.insert(pullRequest).values({ id: pr.id, ...values }).onConflictDoUpdate({ target: pullRequest.id, set: values });
}

// A PR that comes back to the list (e.g. you were added as a reviewer again) is listed again; its review stays as it was.
async function markListed(db: AdoaDb, listed: AdoPullRequest[]): Promise<void> {
  const ids = listed.map((pr) => pr.id);

  if (ids.length > 0) {
    await db.update(pullRequest).set({ isListed: true }).where(and(inArray(pullRequest.id, ids), eq(pullRequest.isListed, false)));
  }
}

// Drafts wait until they're published; a PR whose details wait for the next run gets its review then. No task: the user
// starts the review.
async function addNewReviews(db: AdoaDb, listed: AdoPullRequest[]): Promise<number> {
  const ids = listed.filter((pr) => !pr.isDraft).map((pr) => pr.id);
  const unreviewed = ids.length > 0 ? await withoutReview(db, ids) : [];

  if (unreviewed.length > 0) {
    await db.insert(codeReview).values(unreviewed.map((pr) => ({ prId: pr.id })));
  }

  return unreviewed.length;
}

async function withoutReview(db: AdoaDb, ids: number[]): Promise<PullRequestRow[]> {
  const rows = await db.select({ pr: pullRequest, reviewId: codeReview.prId }).from(pullRequest).leftJoin(codeReview, eq(codeReview.prId, pullRequest.id)).where(inArray(pullRequest.id, ids));

  return rows.filter((row) => row.reviewId === null).map((row) => row.pr);
}

// A PR that left the list: completed or abandoned, no longer yours to review, or its repo was deselected (`mine`: your
// PRs before the repo filter, so the reason says which).
async function closeUnlisted(db: AdoaDb, listed: AdoPullRequest[], mine: AdoPullRequest[]): Promise<number> {
  const ids = listed.map((pr) => pr.id);
  const notListedNow = ids.length > 0 ? notInArray(pullRequest.id, ids) : undefined;
  const gone = await db.select({ id: pullRequest.id }).from(pullRequest).where(and(eq(pullRequest.isListed, true), notListedNow));

  for (const pr of gone) {
    await db.update(pullRequest).set({ isListed: false, syncedAt: new Date() }).where(eq(pullRequest.id, pr.id));
    await closeActiveReview(db, pr.id, mine.some((entry) => entry.id === pr.id) ? REPO_NOT_SELECTED_REASON : UNLISTED_REASON);
  }

  return gone.length;
}

async function closeActiveReview(db: AdoaDb, prId: number, reason: string): Promise<void> {
  const [review] = await db.select({ status: codeReview.status }).from(codeReview).where(eq(codeReview.prId, prId));

  if (review?.status === "active") {
    await closeReview(db, prId, reason, ACTOR);
  }
}
