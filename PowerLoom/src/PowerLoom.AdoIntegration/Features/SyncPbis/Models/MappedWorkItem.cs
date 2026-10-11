namespace PowerLoom.AdoIntegration.Features.SyncPbis.Models;

// A work item as PowerLoom mirrors it. `AdoParentId` is ADO's System.Parent; a child in PowerLoom only when that parent is a
// PBI PowerLoom has. `ContentHash` covers what agents read: title, description and acceptance criteria.
public sealed record MappedWorkItem(
    int AdoId,
    int Rev,
    string Type,
    string Title,
    string AdoState,
    string? IterationPath,
    string? AreaPath,
    string? AssignedTo,
    int? Priority,
    double? BacklogPriority,
    decimal? Effort,
    decimal? RemainingWork,
    int? AdoParentId,
    IReadOnlyList<string> Tags,
    DateTime? AdoChangedAt,
    string DescriptionMd,
    string AcceptanceCriteriaMd,
    string ContentHash);
