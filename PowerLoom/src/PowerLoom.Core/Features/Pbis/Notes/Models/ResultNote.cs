namespace PowerLoom.Features.Pbis.Notes.Models;

// One run's result note, from a `run_result` row: rendered under the task, one note per run (user decision 2026-10-22).
public sealed record ResultNote(
    int AdoId,
    int Id,
    long? RunId,
    string? TaskId,
    string Agent,
    string Status,
    string Body,
    IReadOnlyList<ResultEvidence> Evidence,
    DateTime Created);
