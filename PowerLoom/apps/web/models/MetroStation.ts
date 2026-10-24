// One stop of a PBI's way through the pipeline, as the metro line on its page draws it (user request 2026-10-18).
export interface MetroStation {
  key: string;
  name: string;
  state: "passed" | "skipped" | "current" | "ahead";
  /** How long the PBI stayed there in all, hours; null when it never did. */
  hours: number | null;
  /** Runs of the PBI's agent tasks of this station's kinds, whatever the PBI's status was meanwhile. */
  runs: number;
}
