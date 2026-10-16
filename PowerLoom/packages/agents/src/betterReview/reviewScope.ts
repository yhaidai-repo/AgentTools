import type { PullRequestCheckout, RepoCache, RepoRef } from "@agenttools/runtime";
import type { DiffFile } from "../codeReview/models/DiffFile";
import type { DiffScope } from "../codeReview/models/DiffScope";
import { parseUnifiedDiff, selectScope } from "../codeReview/prDiff";
import type { ReviewMode } from "./models/ReviewMode";

export interface ScopeChoice {
  mode: ReviewMode;
  scope: DiffScope;
  fullPatches: Map<string, string>;
}

// The anchor of a follow-up (user decision 2026-10-16): once a review exists, the next run reviews what changed since the
// commit it saw, only in files the PR changes (a merge of the target branch brings in changes that aren't the PR's).
// A full review when there is no earlier review, the task asks for one, or that commit is gone (a force-push).
export async function chooseScope(repoCache: RepoCache, repo: RepoRef, checkout: PullRequestCheckout, prFiles: DiffFile[], previousCommit: string | null, maxLines: number, forceFull: boolean): Promise<ScopeChoice> {
  const fullPatches = new Map(prFiles.map((file) => [file.path, file.patch]));
  const full = (reason: string): ScopeChoice => ({ mode: { kind: "full", reason }, scope: selectScope(prFiles, maxLines), fullPatches });

  if (forceFull) {
    return full("the task asks for a full review");
  }

  if (!previousCommit) {
    return full("first review of this PR");
  }

  const since = previousCommit === checkout.sourceCommit ? [] : await changedSince(repoCache, repo, previousCommit, checkout.sourceCommit);

  if (since === null) {
    return full(`the last reviewed commit ${previousCommit.slice(0, 8)} is no longer in the repo (force-push?)`);
  }

  return { mode: { kind: "follow-up", baseCommit: previousCommit }, scope: followUpScope(prFiles, since, previousCommit, maxLines), fullPatches };
}

export function followUpScope(prFiles: DiffFile[], since: DiffFile[], previousCommit: string, maxLines: number): DiffScope {
  const prPaths = new Set(prFiles.map((file) => file.path));
  const changed = since.filter((file) => prPaths.has(file.path));
  const selected = selectScope(changed, maxLines);
  const changedPaths = new Set(changed.map((file) => file.path));
  const unchanged = prFiles.filter((file) => !changedPaths.has(file.path)).map((file) => ({ file, reason: `unchanged since the last review (${previousCommit.slice(0, 8)})` }));

  return { reviewed: selected.reviewed, skipped: [...selected.skipped, ...unchanged] };
}

async function changedSince(repoCache: RepoCache, repo: RepoRef, from: string, to: string): Promise<DiffFile[] | null> {
  const diff = await repoCache.diff(repo, from, to).catch(() => null);

  return diff === null ? null : parseUnifiedDiff(diff);
}
