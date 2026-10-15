import type { FindingDraft } from "./FindingDraft";
import type { NoteEdit } from "./NoteEdit";

// Collected in memory during a run and applied only if the run succeeds.
export interface TechWriterDraft {
  edits: NoteEdit[];
  findings: FindingDraft[];
  /** The note that takes the draft's place (write_note's takesDraftPlace): links to the draft are repointed to it. */
  home: string | null;
  /** The run's last message: what it changed and, for a task the user wrote, each criterion met or not. The task's
   *  resolution, so its page shows a result (user, 2026-10-15). */
  summary: string | null;
}
