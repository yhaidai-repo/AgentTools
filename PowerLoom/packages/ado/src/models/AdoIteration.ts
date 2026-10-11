export interface AdoIteration {
  id: string;
  name: string;
  path: string;
  startDate: string | null;
  finishDate: string | null;
  timeFrame: "past" | "current" | "future" | null;
}
