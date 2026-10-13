// One pipeline status: how long PBIs stayed in it before leaving (over every exit), and who is in it right now.
export interface StatusDwell {
  status: string;
  /** Exits from the status; a PBI that passes it twice counts twice. */
  transitions: number;
  averageHours: number;
  p95Hours: number;
  inStatusNow: number;
  /** How long the PBI that has been in it longest has waited so far; null when none is in it. */
  longestWaitHours: number | null;
}
