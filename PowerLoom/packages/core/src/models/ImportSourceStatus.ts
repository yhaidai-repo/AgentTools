// What the pbi-import job saw in one import source on its last run.
export interface ImportSourceStatus {
  source: string;
  waiting: number;
  failed: number;
}
