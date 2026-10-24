namespace PowerLoom.Features.Pbis.Notes.Models;

// One source behind a result's claim, as the agents record it: the read-log id, where it is for a reader, what it shows.
public sealed record ResultEvidence(string Source, string Ref, string Note, string? Quote);
