// Any event with these fields can be traced; the rest of the event becomes the payload.
export interface TraceEntry {
  runId: string;
  seq: number;
  at: Date;
  type: string;
  [field: string]: unknown;
}
