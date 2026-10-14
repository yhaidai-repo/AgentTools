namespace PowerLoom.Features.Pbis.Notes.Models;

// The refinement note's data, parsed from the `refinement` row's JSON columns. No `EstHours`: a refinement from before
// refinement estimated.
public sealed record RefinementNote(
    int AdoId,
    int Version,
    long? RunId,
    DateTime Created,
    string Summary,
    IReadOnlyList<string> ScopeIn,
    IReadOnlyList<string> ScopeOut,
    IReadOnlyList<AcceptanceGap> AcGaps,
    IReadOnlyList<string> Dependencies,
    IReadOnlyList<RepoReason> Repos,
    IReadOnlyList<string> Assumptions,
    IReadOnlyList<RelevantDoc> RelevantDocs,
    IReadOnlyList<string> DocsRead,
    decimal? EstHours,
    string? EstimateBasis,
    RefinementDetails? Details = null);
