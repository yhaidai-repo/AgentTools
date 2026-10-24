export interface StoredTraceEvent {
  runId: string;
  seq: number;
  at: Date;
  type: string;
  payload: Record<string, unknown>;
}
