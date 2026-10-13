// Where a successful run's created tasks are written.
export interface TaskCommitContext {
  pbiId: number;
  /** The creating task: the parent of everything it created. */
  parentTaskId: string;
  runId: number;
  depth: number;
  /** The docs vault, where a tech-writer task's note lives. */
  docsVault: string;
}
