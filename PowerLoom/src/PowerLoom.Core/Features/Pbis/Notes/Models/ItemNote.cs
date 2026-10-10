using System.Text.Json;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Pbis.Notes.Models;

// An item as its note shows it. `Resolution`: the person's answer (question) or outcome note (human task).
// `Attachments`: vault file names of the uploads that came with the answer.
public sealed record ItemNote(
    string Id,
    ItemKind Kind,
    int AdoId,
    string? ParentId,
    string Title,
    string Status,
    string Assignee,
    string? Body,
    JsonElement? Data,
    string? Resolution,
    IReadOnlyList<string> Attachments,
    long? RunId,
    DateTime Created,
    DateTime Updated);
