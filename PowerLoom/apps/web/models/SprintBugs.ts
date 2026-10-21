// The bugs counted in one sprint (user request 2026-10-21): from QA (synced from Azure DevOps) and found by PowerLoom
// (reported inside it, by an agent or from a chat), with who reported PowerLoom's.
export interface SprintBugs {
  iterationPath: string;
  qa: number;
  powerloom: number;
  /** PowerLoom's bugs per reporter: an agent's id, or "chat". */
  byReporter: Record<string, number>;
}
