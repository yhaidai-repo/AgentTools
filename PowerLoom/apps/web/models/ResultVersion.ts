import type { ResultKind } from "./ResultKind";

// One version of an agent result, without its content: enough for the version picker.
export interface ResultVersion {
  kind: ResultKind;
  /** The row's id (refinement, design, estimate) or the item's id (TR-…, RR-…). */
  id: string;
  /** v1, v2, … in the order the versions were written. */
  label: string;
  runId: number | null;
  agent: string | null;
  at: Date;
  /** The result item's status (final, superseded) or the run result's (complete, partial, blocked); null for the other kinds. */
  status: string | null;
}
