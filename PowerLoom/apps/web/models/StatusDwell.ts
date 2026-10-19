// How long PBIs stay in one pipeline status before leaving it, over every transition out of it. The median, not the
// average: one forgotten PBI made the average longer than the p95 (user, 2026-10-18).
export interface StatusDwell {
  status: string;
  transitions: number;
  medianHours: number;
  p95Hours: number;
}
