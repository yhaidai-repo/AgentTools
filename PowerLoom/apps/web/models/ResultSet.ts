import type { ResultVersion } from "./ResultVersion";

// Every version of one result: a PBI's refinement, design or estimate, or one task's research results or test reports.
export interface ResultSet {
  /** Unique on its page, e.g. "design" or "TT-30474-002". */
  key: string;
  title: string;
  /** The task the results answer, when there is one task (a research or test task). */
  task: { id: string; pbiId: number | null } | null;
  /** Oldest first. */
  versions: ResultVersion[];
  /** Shown while there is no version yet. */
  empty: string;
}
