import {
  loadPbiResultSets as loadPbiResultSetsOf,
  loadReviewResultSet as loadReviewResultSetOf,
  loadSiblingVersions as loadSiblingVersionsOf,
  loadTaskResultSets as loadTaskResultSetsOf,
  type AgentResult,
  type ResultOwner,
  type ResultSet,
  type ResultVersion,
} from "@powerloom/core";
import { getDb } from "./db";

// A PBI's results on its page: its estimates, refinements and designs, then each task's results.
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
