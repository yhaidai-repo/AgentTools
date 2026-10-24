namespace PowerLoom.Features.Docs.Records.Models;

// A record by its register note (relative to the vault root) and id.
public sealed record RecordRef(string Path, string Id);
