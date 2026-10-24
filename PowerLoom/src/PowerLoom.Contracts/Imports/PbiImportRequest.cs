namespace PowerLoom.Contracts.Imports;

// One item from an import source (a mail, a file): the PBIs it names, by id or by links in its content. `Source` is
// who sent it (e.g. "outlook"); `SourceRef` the item's id there, so a re-sent item isn't imported twice; `Prepare`
// (default true) prepares the new PBIs for refinement after the sync.
public sealed record PbiImportRequest(
    string Source,
    string SourceRef,
    string? Title,
    string? From,
    string? OccurredAt,
    IReadOnlyList<int>? AdoIds,
    string? Html,
    string? Text,
    bool? Prepare);
