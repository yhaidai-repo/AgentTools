/** A task's latest result, as a rerun's first message carries it. */
export interface PreviousResult {
  runId: number | null;
  status: string;
  body: string;
}
