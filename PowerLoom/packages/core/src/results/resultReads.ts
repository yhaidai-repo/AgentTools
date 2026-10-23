import type { ResultSet } from "../models/ResultSet";
import type { ResultSetSummary } from "../models/ResultSetSummary";
import type { ResultVersionSummary } from "../models/ResultVersionSummary";

// The page's result sets as a chat reads them: no empty texts or preferred version, each version with the kind and id
// result.get takes and whether it is the newest.
export function toResultSetSummaries(sets: ResultSet[]): ResultSetSummary[] {
  return sets.map((set) => ({ key: set.key, title: set.title, task: set.task, versions: set.versions.map((version, index) => toVersionSummary(version, index === set.versions.length - 1)) }));
}

function toVersionSummary(version: ResultSet["versions"][number], isLatest: boolean): ResultVersionSummary {
  return { kind: version.kind, id: version.id, label: version.label, runId: version.runId, agent: version.agent, createdAt: version.at, status: version.status, isLatest };
}
