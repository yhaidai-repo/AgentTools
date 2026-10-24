// One note as vault.notes lists it: every note's path, title and authors; the notes PowerLoom wrote also carry the run and
// what it did (created or updated, when the tech-writer recorded it).
export interface VaultNoteEntry {
  path: string;
  title: string;
  authors: string[];
  /** The run PowerLoom last changed the note in (its authors stamp); only on notes PowerLoom wrote. */
  runId?: number | null;
  action?: "created" | "updated" | null;
  createdByRunId?: number | null;
}
