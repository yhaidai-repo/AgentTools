import { pullRequest, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";

type PullRequestRow = typeof pullRequest.$inferSelect;

// A local repo's review (origin local-repo) has no pull request and nothing syncs its branch: each run records the head it
// reviewed, so the page shows the commit and a re-run picks up what came since (user decision 2026-10-25).
export const LOCAL_REPO_ORIGIN = "local-repo";

/** The PR row as the run saw it: a local review's head moves to the commit the run checked out. */
export async function recordLocalRepoHead(db: PowerLoomDb, pr: PullRequestRow, sourceCommit: string): Promise<PullRequestRow> {
  if (pr.origin !== LOCAL_REPO_ORIGIN || pr.sourceCommit === sourceCommit) {
    return pr;
  }

  await db.update(pullRequest).set({ sourceCommit, syncedAt: new Date() }).where(eq(pullRequest.id, pr.id));

  return { ...pr, sourceCommit };
}
