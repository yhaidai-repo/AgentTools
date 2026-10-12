export interface FailedRun {
  id: number;
  agentId: string;
  itemId: string | null;
  pbiId: number | null;
  startedAt: Date;
  outcome: string;
  error: string | null;
}
