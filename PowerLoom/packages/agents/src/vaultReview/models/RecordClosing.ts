import type { RecordEvidence } from "./RecordEvidence";
import type { RecordRef } from "./RecordRef";

// Why a record is closed: fixed (known issues only), resolved, or a duplicate of another record.
export interface RecordClosing {
  status: "fixed" | "resolved" | "duplicate";
  /** Duplicate only: the record this one repeats. */
  duplicateOf: RecordRef | null;
  evidence: RecordEvidence[];
}
