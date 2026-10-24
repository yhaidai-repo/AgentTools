namespace PowerLoom.AdoIntegration.Features.SyncPbis.Models;

// A work item as PowerLoom mirrors it. `AdoParentId` is ADO's System.Parent; a child in PowerLoom only when that parent is a
// PBI PowerLoom has. `ContentHash` covers title, description and acceptance criteria; `ExtraFieldsMd` (the team's own
// rich-text fields, ExtraTextFields) is left out of it, so adding it marked no refined PBI stale.
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
    string ExtraFieldsMd,
    IReadOnlyList<string> AttachedFileUrls,
    string ContentHash);
