namespace PowerLoom.Contracts.Imports;

// One item an import source has waiting. The sync imports it, then tells the source how it went: `Complete` drops the
// item (e.g. deletes the file); `Reject` sets it aside with the reason (e.g. failed/ plus a .reason.txt).
public sealed record PendingImport(string Label, Outcome<PbiImportRequest> Request, Func<CancellationToken, Task> Complete, Func<string, CancellationToken, Task> Reject);
