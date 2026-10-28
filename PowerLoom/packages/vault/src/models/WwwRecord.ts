import type { RecordWorkReference } from "./RecordWorkContext";
// One record read from a vault's www-log.md (the www-record skill's format).
export interface WwwRecord {
  workItems?: RecordWorkReference[];
  id: string;
  title: string;
  created: string;
  updated: string;
  kind: string;
  project: string;
  fault: string;
  status: string;
}
