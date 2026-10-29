/** What a write command changes: a PBI, an item (a task or any item of a PBI), a schedule or an agent; or text that
 *  names no PBI (a reference): no run owns it. */
export interface LiveTestTarget {
  kind: "pbi" | "item" | "schedule" | "agent" | "reference";
  id: string;
}
