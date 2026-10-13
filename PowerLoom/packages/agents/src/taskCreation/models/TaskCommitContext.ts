// Where a successful run's created tasks are written.
export interface TaskCommitContext {
  /** Null for a task without a PBI: what it creates is numbered across the app and lives in `vault`. */
  pbiId: number | null;
  /** The creating task's vault. */
  vault: string;
  /** The creating task: the parent of everything it created. */
  parentTaskId: string;
  runId: number;
  depth: number;
  /** The docs vault, where a tech-writer task's note lives. */
  docsVault: string;
}
