// PBIs that reached a pipeline status in one week (Monday start, UTC).
export interface WeekThroughput {
  /** YYYY-MM-DD of the Monday. */
  week: string;
  byStatus: Record<string, number>;
}
