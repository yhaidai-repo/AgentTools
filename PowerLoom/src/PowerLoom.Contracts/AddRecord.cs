namespace PowerLoom.Contracts;

// Adds a stored record to its vault's file (Docs / Records). `SourceId`: the `www_record` id, or the finding's item id.
public sealed record AddRecord(string Vault, RecordKind Kind, string SourceId) : IVaultScoped;
