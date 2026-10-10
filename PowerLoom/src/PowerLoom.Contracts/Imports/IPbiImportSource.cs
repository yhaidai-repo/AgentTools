namespace PowerLoom.Contracts.Imports;

// One way PBIs come into adoa (user decision 2026-10-02): the PBI sync reads every source through this, so a new
// source needs no change to the sync. `Id` is also the request's `Source`, shown in the Imports panel.
public interface IPbiImportSource
{
    string Id { get; }

    // Waiting items, oldest first, at most `limit`.
    Task<IReadOnlyList<PendingImport>> ReadPendingAsync(string vault, int limit, CancellationToken cancellation);

    Task<ImportSourceStatus> StatusAsync(string vault, CancellationToken cancellation);
}
