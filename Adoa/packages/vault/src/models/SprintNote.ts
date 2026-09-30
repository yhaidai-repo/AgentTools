import type { SprintNoteRow } from "./SprintNoteRow";

export interface SprintNote {
  iterationPath: string;
  name: string;
  timeframe: "past" | "current" | "future";
  startDate: string | null;
  finishDate: string | null;
  rows: SprintNoteRow[];
}
