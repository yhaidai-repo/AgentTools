namespace PowerLoom.Features.Pbis.Notes.Models;

public sealed record AffectedAreaNote(string Area, string Change, IReadOnlyList<NoteEvidence> Evidence);
