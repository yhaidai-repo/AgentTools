export interface ImportSettings {
  /** How often the pbi-import job reads the import sources. */
  cron: string;
  /** Items imported per run, over all sources together; the rest wait for the next run. */
  maxItemsPerRun: number;
}
