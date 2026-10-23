// One agent run going on right now, as PowerLoom's status lists it; `since` is an ISO string.
export interface RunInProgress {
  taskId: string;
  agentId: string;
  pbiId: number | null;
  since: string;
  stuck: boolean;
}
