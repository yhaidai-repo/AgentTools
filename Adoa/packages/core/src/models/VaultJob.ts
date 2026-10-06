// A job that runs for one vault (sync, pbi-import, pull-requests): each vault has its own schedule, keyed by its name.
export interface VaultJob {
  vault: string;
}
