// A docs-vault note adoa's tech-writer wrote, from its `authors` entry "adoa tech-writer (RUN-n, YYYY-MM-DD)": adoa's
// latest change to it, and whether that change created the note (from vault_note_write).
export interface AdoaNote {
  path: string;
  title: string;
  runId: number | null;
  date: string;
  /** What the latest adoa run did to the note; null when it wasn't recorded. */
  action: "created" | "updated" | null;
  /** The run that created the note, when adoa did. */
  createdByRunId: number | null;
}
