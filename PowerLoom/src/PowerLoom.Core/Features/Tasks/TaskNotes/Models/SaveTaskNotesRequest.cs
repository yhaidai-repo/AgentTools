namespace PowerLoom.Features.Tasks.TaskNotes.Models;

// PUT /api/items/{id}/user-notes: the new notes, and the notes the page showed (the save is refused when they changed
// meanwhile, so nothing unseen is overwritten; null skips the check).
public sealed record SaveTaskNotesRequest(string Text, string? LoadedText);
