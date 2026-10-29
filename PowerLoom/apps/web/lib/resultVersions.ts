import {
  latestPbiVersion,
  loadPbiResultSets as loadPbiResultSetsOf,
  loadReviewResultSet as loadReviewResultSetOf,
  loadSiblingVersions as loadSiblingVersionsOf,
  loadTaskResultSets as loadTaskResultSetsOf,
  type AgentResult,
  type PbiResultKind,
  type ResultOwner,
  type ResultSet,
  type ResultVersion,
} from "@powerloom/core";
import { getDb } from "./db";

// The newest version of a kind a PBI has, null when it has none.
export function loadLatestPbiVersion(kind: PbiResultKind, adoId: number): Promise<ResultVersion | null> {
  return latestPbiVersion(getDb(), kind, adoId);
}

// A PBI's results on its page: its estimates, refinements and designs (plans and builds when it has any), then each task's results.
export function loadPbiResultSets(adoId: number): Promise<ResultSet[]> {
  return loadPbiResultSetsOf(getDb(), adoId);
}

// A pull request's reviews, one version per successful review run; a review task's page opens on its own (`ownRunIds`).
export function loadReviewResultSet(prId: number, ownRunIds: number[] = []): Promise<ResultSet> {
  return loadReviewResultSetOf(getDb(), prId, ownRunIds);
}

// What one task's runs wrote.
export function loadTaskResultSets(task: { id: string; pbiId: number | null; kind: string; data: unknown }, runIds: number[]): Promise<ResultSet[]> {
  return loadTaskResultSetsOf(getDb(), task, runIds);
}

// The versions beside one result on its full page.
export function loadSiblingVersions(result: AgentResult, owner: ResultOwner): Promise<ResultVersion[]> {
  return loadSiblingVersionsOf(getDb(), result, owner);
}
