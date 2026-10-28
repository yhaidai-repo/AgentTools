// A task type agents may create: which item it becomes and what the creating agent is told it is for.
export interface TaskTarget {
  type: string;
  /** The task's kind: a built-in type, or a custom type an agent made in the UI handles. */
  kind: string;
  /** `pbi`: numbered per PBI (AT-36756-002); `global`: numbered across the app and kept off the PBI (WT-014). */
  scope: "pbi" | "global";
  prefix: "RT" | "AT" | "DT" | "WT" | "TT" | "XT";
  purpose: string;
  /** A docs task fixes one docs-vault note, so it names the note. */
  needsDocPath: boolean;
}
