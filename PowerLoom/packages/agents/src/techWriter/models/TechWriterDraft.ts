import type { FindingDraft } from "./FindingDraft";
import type { NoteEdit } from "./NoteEdit";

// Collected in memory during a run and applied only if the run succeeds.
export interface TechWriterDraft {
  edits: NoteEdit[];
  findings: FindingDraft[];
  /** The note that takes the draft's place (write_note's takesDraftPlace): links to the draft are repointed to it. */
  home: string | null;
}
