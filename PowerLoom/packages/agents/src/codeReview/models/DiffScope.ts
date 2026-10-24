import type { DiffFile } from "./DiffFile";

// Which changed files the agent reviews this run (at most maxDiffLines changed lines, largest first) and which it skips, with why.
export interface DiffScope {
  reviewed: DiffFile[];
  skipped: { file: DiffFile; reason: string }[];
}
