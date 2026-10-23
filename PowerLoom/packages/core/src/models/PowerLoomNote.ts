// A docs-vault note PowerLoom's tech-writer wrote, from its `authors` entry "PowerLoom tech-writer (RUN-n, YYYY-MM-DD)": PowerLoom's
// latest change to it, and whether that change created the note (from vault_note_write).
export interface PowerLoomNote {
  path: string;
  title: string;
  runId: number | null;
  date: string;
  /** What the latest PowerLoom run did to the note; null when it wasn't recorded. */
  action: "created" | "updated" | null;
  /** The run that created the note, when PowerLoom did. */
  createdByRunId: number | null;
}
