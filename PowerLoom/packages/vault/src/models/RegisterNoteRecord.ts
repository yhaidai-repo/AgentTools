import type { RecordWorkReference } from "./RecordWorkContext";
// One record read from a project's open-questions or known-issues register note (the vault rules' record layout).
export interface RegisterNoteRecord {
  workItems?: RecordWorkReference[];
  id: string;
  title: string;
  /** Open, Resolved, Fixed…; empty when the record has no metadata line. */
  status: string;
  resolved: boolean;
  created: string | null;
  updated: string | null;
}
