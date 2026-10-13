namespace PowerLoom.Features.Pbis.Notes.Models;

public sealed record TestDataNote(bool Applicable, IReadOnlyList<EvidencedText> Given, IReadOnlyList<string> Missing, string Reason);
