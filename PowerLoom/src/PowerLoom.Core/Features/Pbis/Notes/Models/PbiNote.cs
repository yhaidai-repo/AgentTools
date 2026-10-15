namespace PowerLoom.Features.Pbis.Notes.Models;

// A PBI as its note shows it; `ParentId` is the PBI this item is a child of. `ExtraFieldsMd` holds the team's own ADO
// rich-text fields; `DiscussionMd` is null until the sync has read the ADO discussion.
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
    string? ExtraFieldsMd,
    string? DiscussionMd,
    int? ParentId,
    DateTime Created,
    DateTime Updated);
