export interface SyncSettings {
  cron: string;
  maxItemsPerRun: number;
  /** "current" (follows ADO) or an iteration path. */
  sprint: string;
  /** ADO states to pull; empty = all states. */
  states: string[];
}
