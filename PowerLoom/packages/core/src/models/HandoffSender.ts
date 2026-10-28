// The task and agent a hand-off comes from; `runId` is the run that made it.
export interface HandoffSender {
  taskId: string;
  agent: string;
  runId: number | null;
}
