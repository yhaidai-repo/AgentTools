namespace PowerLoom.Features.Pbis.Delete.Models;

// Each refusal names its PBI and the reason (an agent run on it, not in PowerLoom).
public sealed record DeletedPbis(List<DeletedPbi> Deleted, List<string> Refused);
