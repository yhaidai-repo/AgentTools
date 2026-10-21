// A bug filed under the PBI (a [BUG] task child, QA's or the agent's), as a test run retests it.
export interface ChildBug {
  adoId: number;
  title: string;
  adoState: string;
  /** The repro steps (ADO description or repro steps field, as the sync renders it); null when it has none. */
  steps: string | null;
}
