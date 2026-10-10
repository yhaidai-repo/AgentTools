namespace PowerLoom.Features.Pbis.Notes.Models;

// A PBI as its note shows it; `ParentId` is the PBI this item is a child of.
public sealed record PbiNote(
    int AdoId,
    string Title,
    string Type,
    string AdoState,
    string AdoUrl,
    string PipelineStatus,
    string? IterationPath,
    string? AreaPath,
    string? AssignedTo,
    int? Priority,
    IReadOnlyList<string> Tags,
    string? DescriptionMd,
    string? AcceptanceCriteriaMd,
    int? ParentId,
    DateTime Created,
    DateTime Updated);
