import type { HunkLine } from "./HunkLine";

// One `@@` block of an Update File: the lines to find (context and removed) and what replaces them.
export interface PatchHunk {
  /** The text after `@@`: a line to find first, the hunk is searched below it. Null for a bare `@@`. */
  anchor: string | null;
  lines: HunkLine[];
  /** `*** End of File` closed the hunk: its lines end the file. */
  atEnd: boolean;
}
