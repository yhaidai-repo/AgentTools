namespace PowerLoom.Features.Pbis.Notes.Models;

// A PBI's upload as the vault names it (without the file bytes).
public sealed record VaultAttachment(int Id, string FileName, string? ItemId, string? SourceUrl, string Ref, string VaultName);
