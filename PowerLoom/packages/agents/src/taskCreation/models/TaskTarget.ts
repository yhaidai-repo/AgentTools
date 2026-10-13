// An agent that takes tasks other agents create: which item it gets and what the creating agent is told it is for.
export interface TaskTarget {
  agentId: string;
  kind: "research" | "design" | "docs";
  /** `pbi`: numbered per PBI (AT-36756-002); `global`: numbered across the app and kept off the PBI (WT-014). */
  scope: "pbi" | "global";
  prefix: "AT" | "DT" | "WT";
  purpose: string;
  /** The tech-writer fixes one docs-vault note, so its task names the note. */
  needsDocPath: boolean;
}
