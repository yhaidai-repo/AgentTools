// How long PBIs stay in one pipeline status before leaving it, over every transition out of it.
export interface StatusDwell {
  status: string;
  transitions: number;
  averageHours: number;
  p95Hours: number;
}
