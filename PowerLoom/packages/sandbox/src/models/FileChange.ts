export interface FileChange {
  path: string;
  op: "add" | "update" | "delete" | "move";
  /** The new path of a moved file. */
  movedTo?: string;
}
