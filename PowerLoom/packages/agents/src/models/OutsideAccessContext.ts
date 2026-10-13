// Who is reading: the run's identity for the data access log (one per run, built from the task and the session).
export interface OutsideAccessContext {
  vault: string;
  agentId: string;
  runId: number;
  taskId: string | null;
  pbiId: number | null;
}
