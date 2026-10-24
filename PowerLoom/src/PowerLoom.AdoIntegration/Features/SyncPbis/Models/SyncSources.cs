namespace PowerLoom.AdoIntegration.Features.SyncPbis.Models;

// Which sources one sync run reads: the vault's sprint (Backlog → Sync now, the sync cron) or the import sources
// (Backlog → Import now, the import cron). Both end in the same sync; the sources decide prepare and acknowledge.
public enum SyncSources
{
    Sprint,
    Imports,
}
