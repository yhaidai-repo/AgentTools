export interface SyncSettings {
  cron: string;
  maxItemsPerRun: number;
  /** "current" (follows ADO) or an iteration path. */
  sprint: string;
}
