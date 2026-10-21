namespace PowerLoom.Features.Cleanup.Models;

// A closed or done PBI with a backlog folder; `ClosedAt` is null when nothing says since when.
public sealed record ClosedPbi(int AdoId, string VaultPath, DateTime? ClosedAt);
