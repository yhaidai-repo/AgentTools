// A recent job run (the ADO sync, the pull request check) as PowerLoom's status lists it; dates are ISO strings.
export interface SyncRun {
  id: number;
  stage: string;
  outcome: string;
  error: string | null;
  startedAt: string;
  endedAt: string | null;
}
