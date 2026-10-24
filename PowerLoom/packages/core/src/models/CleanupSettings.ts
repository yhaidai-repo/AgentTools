// The artefact cleanup's buffers (PowerLoom's CleanupSettings): days per store, 0 = off; dryRun reports without deleting.
export interface CleanupSettings {
  dryRun: boolean;
  closedPbiDays: number;
  trashDays: number;
  failedImportDays: number;
  runEventDays: number;
  browserArtefactDays: number;
  failedRunBrowserArtefactDays: number;
}
