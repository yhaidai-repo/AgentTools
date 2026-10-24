namespace PowerLoom.Features.Pbis.Notes.Models;

public sealed record EvidencedText(string What, IReadOnlyList<NoteEvidence> Evidence);
