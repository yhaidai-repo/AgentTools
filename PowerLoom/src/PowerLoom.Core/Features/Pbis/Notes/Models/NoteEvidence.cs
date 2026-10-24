namespace PowerLoom.Features.Pbis.Notes.Models;

// One source behind a Better agent's statement: the run's source id, where it is for a reader, what it shows.
public sealed record NoteEvidence(string Source, string Ref, string Note);
