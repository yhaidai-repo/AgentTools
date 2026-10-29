// A UAT test `planning inspect` (schema_version 1) lists as unresolved: pending, an issue, skipped or blocked.
export interface InspectUatItem {
  test?: number | string;
  name?: string;
  result?: string;
  reason?: string;
}
