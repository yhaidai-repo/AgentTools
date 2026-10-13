namespace PowerLoom.Features.Pbis.Notes.Models;

public sealed record BlockerNote(string What, string ResolvedBy, IReadOnlyList<NoteEvidence> Evidence);
