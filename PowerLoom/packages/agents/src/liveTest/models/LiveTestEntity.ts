/** Something a live-test run created and must remove: a PBI (its ADO id), a task (with its PBI, null for none), a schedule or an agent. */
export interface LiveTestEntity {
  kind: "pbi" | "task" | "schedule" | "agent";
  id: string;
  pbiId?: number | null;
}
