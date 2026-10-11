namespace PowerLoom.AdoIntegration.Features.SyncPbis.Models;

// What an import did with one PBI (the `pbi_import.results` JSON): prepared, synced, in-pipeline (left alone),
// deleted (in PowerLoom), refused (already started in ADO) or failed, with the reason.
public sealed record PbiImportResult(int AdoId, string Outcome, string? Detail = null)
{
    public const string Prepared = "prepared";
    public const string Synced = "synced";
    public const string InPipeline = "in-pipeline";
    public const string Deleted = "deleted";
    public const string Refused = "refused";
    public const string Failed = "failed";
}
