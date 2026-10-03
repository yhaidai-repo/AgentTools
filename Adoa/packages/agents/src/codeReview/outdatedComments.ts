import type { reviewComment } from "@adoa/db";
import type { RepoCache, RepoRef } from "@agenttools/runtime";
import { changedOldRanges, overlaps, parseUnifiedDiff } from "./prDiff";

type CommentRow = typeof reviewComment.$inferSelect;

const STILL_OPEN = ["open", "answered"];

// Earlier open or answered comments whose lines changed between their commit and the commit reviewed now (user decision
// 2026-10-02: after a rerun on a newer commit they're marked outdated). A commit git can no longer reach (force-push) counts
// as changed.
export async function findOutdatedComments(repoCache: RepoCache, repo: RepoRef, comments: CommentRow[], headCommit: string): Promise<string[]> {
  const candidates = comments.filter((comment) => STILL_OPEN.includes(comment.status) && comment.commit !== headCommit);
  const outdated = await Promise.all(candidates.map((comment) => isOutdated(repoCache, repo, comment, headCommit)));

  return candidates.filter((_, index) => outdated[index]).map((comment) => comment.id);
}

async function isOutdated(repoCache: RepoCache, repo: RepoRef, comment: CommentRow, headCommit: string): Promise<boolean> {
  const diff = await repoCache.diff(repo, comment.commit, headCommit, [comment.filePath]).catch(() => null);

  if (diff === null) {
    return true;
  }

  const [file] = parseUnifiedDiff(diff);

  if (!file) {
    return false;
  }

  return file.status === "deleted" || file.status === "renamed" || overlaps(changedOldRanges(file.patch), comment.startLine, comment.endLine);
}
