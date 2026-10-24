/** What a write command changes: a PBI, an item (a task or any item of a PBI), a schedule or an agent. */
export interface LiveTestTarget {
  kind: "pbi" | "item" | "schedule" | "agent";
  id: string;
}
