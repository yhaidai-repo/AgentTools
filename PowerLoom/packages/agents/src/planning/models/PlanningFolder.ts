// The worktree's .planning/ folder as write_plan reads it: GSD's own inspect snapshot and its files.
export interface PlanningFolder {
  inspect(): Promise<unknown>;
  /** A file's text by its path inside .planning/, or null when it doesn't exist. */
  read(path: string): Promise<string | null>;
}
