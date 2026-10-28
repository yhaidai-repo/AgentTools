import type { FileChange } from "./FileChange";

export interface PatchApplied {
  changed: FileChange[];
}
