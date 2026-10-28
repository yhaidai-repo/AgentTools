// One cause reported again and again: the same kind, tool and target in the period.
export interface FailureReportGroup {
  kind: string;
  tool: string | null;
  target: string;
  reports: number;
  /** Runs that reported it; a chat's report has no run. */
  runs: number;
  agents: string[];
  lastReportedAt: Date;
}
