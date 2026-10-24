import type { AdoPrComment } from "./AdoPrComment";

// A PR comment thread: on a file and line range when `filePath` is set, else on the whole PR. `status` is ADO's:
// active, fixed, wontFix, closed, byDesign, pending, or unknown for threads without one (system threads).
export interface AdoPrThread {
  id: number;
  status: string;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  comments: AdoPrComment[];
}
