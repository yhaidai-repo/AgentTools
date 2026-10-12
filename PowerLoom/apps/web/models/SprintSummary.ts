// One sprint as its snapshots describe it: the last snapshot day's counts, plus how long it was snapshotted.
export interface SprintSummary {
  iterationPath: string;
  firstDay: string;
  lastDay: string;
  days: number;
  items: number;
  done: number;
  /** Null when ADO carries no effort on the sprint's items. */
  effort: number | null;
}
