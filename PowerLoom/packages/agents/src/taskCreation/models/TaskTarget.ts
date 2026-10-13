// A task type agents may create: which item it becomes and what the creating agent is told it is for.
export interface TaskTarget {
  type: string;
  kind: "research" | "design" | "docs";
  /** `pbi`: numbered per PBI (AT-36756-002); `global`: numbered across the app and kept off the PBI (WT-014). */
  scope: "pbi" | "global";
  prefix: "AT" | "DT" | "WT";
  purpose: string;
  /** A docs task fixes one docs-vault note, so it names the note. */
  needsDocPath: boolean;
}
