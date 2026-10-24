// One changed file of a pull request's diff.
export interface DiffFile {
  /** The file's path in the PR's commit; for a deleted file, its old path. */
  path: string;
  /** Set when the file was renamed. */
  oldPath: string | null;
  status: "added" | "modified" | "deleted" | "renamed" | "binary";
  added: number;
  removed: number;
  /** The file's unified diff (hunks with 3 lines of context). */
  patch: string;
}
