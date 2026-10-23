import type { ResultVersionSummary } from "./ResultVersionSummary";

// Every version of one result as result.versions answers it: a PBI's refinement, design or estimate, one task's
// research results, test reports or run results, or a pull request's reviews. Oldest first.
export interface ResultSetSummary {
  /** The set's key on its page, e.g. "design", "TT-30474-002" or "run-RT-30474-001". */
  key: string;
  title: string;
  /** The task the results answer, when there is one task. */
  task: { id: string; pbiId: number | null } | null;
  versions: ResultVersionSummary[];
}
