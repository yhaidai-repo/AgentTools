export interface SprintRef {
  path: string;
  name: string;
  timeframe: "past" | "current" | "future";
  startDate: string | null;
  finishDate: string | null;
}
