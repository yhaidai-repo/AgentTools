namespace PowerLoom.Features.Pbis.Notes.Models;

// One agent estimate (a pbi_estimate row) as the notes show it. No `AgentHours`: a refinement estimate from before
// record_estimate.
public sealed record EstimateNote(
    string Agent,
    long? RunId,
    decimal HumanHours,
    decimal? AgentHours,
    short? Complexity,
    string? Confidence,
    string Basis);
