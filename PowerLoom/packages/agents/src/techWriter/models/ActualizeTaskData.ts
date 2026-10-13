// What the vault review stores on a tech-writer task that asks for an existing note to be brought up to date
// (local_item.data; user decision 2026-10-03).
export interface ActualizeTaskData {
  key: string;
  mode: "actualize";
  /** Folder name under the vaults root, e.g. work-projects. */
  vault: string;
  /** Relative to the vault root. */
  path: string;
  project: string;
  reasons: string;
  suspectFacts: string[];
  /** The task that asked for it (a vault review or an agent's task); absent when the user created it. */
  reviewTask?: string;
}
