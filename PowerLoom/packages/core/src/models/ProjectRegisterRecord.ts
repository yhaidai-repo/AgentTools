import type { RegisterNoteRecord } from "@powerloom/vault";

// A register record with the project whose register holds it and that register note's path in the vault.
export interface ProjectRegisterRecord extends RegisterNoteRecord {
  project: string;
  path: string;
}
