// Where a successful run's created tasks are written.
export interface TaskCommitContext {
  /** Null for a task without a PBI: what it creates is numbered across the app and lives in `vault`. */
  pbiId: number | null;
  /** The creating task's vault. */
  vault: string;
  /** The creating task: the parent of everything it created. */
  parentTaskId: string;
  /** The creating task's agent: the sender of its hand-offs. */
  agent: string;
  runId: number;
  depth: number;
  /** The docs vault, where a tech-writer task's note lives. */
  docsVault: string;
  /** The creating run's repos: a research task without a PBI reads them (the PBI's otherwise). */
  repos?: string[];
}
