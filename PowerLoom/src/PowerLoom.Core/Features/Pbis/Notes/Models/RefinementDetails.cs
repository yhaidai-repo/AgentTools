namespace PowerLoom.Features.Pbis.Notes.Models;

// Better Refinement's details (refinement.details, written by the agent-runner in camelCase); null for earlier refinements.
public sealed record RefinementDetails(
    string Status,
    IReadOnlyList<EvidencedText> Sources,
    IReadOnlyList<AffectedAreaNote> AffectedAreas,
    TestDataNote TestData,
    IReadOnlyList<BlockerNote> Blockers,
    string NextReason);
