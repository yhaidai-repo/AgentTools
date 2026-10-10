using PowerLoom.Domain.Pbis.Models;

namespace PowerLoom.Features.Pbis.Notes.Models;

// The design note's data, parsed from the `design` row's JSON columns.
public sealed record DesignNote(
    int AdoId,
    int Version,
    long? RunId,
    DateTime Created,
    string Approach,
    IReadOnlyList<DesignAlternative> Alternatives,
    IReadOnlyList<DesignPlanStep> Plan,
    IReadOnlyList<DesignRisk> Risks,
    IReadOnlyList<DesignTest> Tests,
    IReadOnlyList<string> Assumptions,
    decimal? EstHumanH,
    decimal? EstAgentH,
    short? Complexity,
    string? Confidence,
    string EstimateBasis);
