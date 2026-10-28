import type { RecordWorkReference } from "@powerloom/vault";
// One record of a vault register (What went wrong, known issues, open questions) as the Maintenance tab lists it.
export interface RegisterRow {
  workItems?: RecordWorkReference[];
  key: string;
  id: string;
  project: string;
  title: string;
  /** The register note it lives in, opened in Obsidian. */
  path: string;
  /** Kind and fault of a What-went-wrong record; empty for issues and questions. */
  facts: string[];
  status: string;
  isOpen: boolean;
  /** An open What-went-wrong record is a miss to act on; open issues and questions are the vault's knowledge backlog. */
  needsAttention: boolean;
  date: string | null;
}
