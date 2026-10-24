namespace PowerLoom.Features.Docs.Records.Models;

// A chat's facts for a docs vault draft (vault_capture without a run): written at once, after the user's yes.
public sealed record CaptureDraftRequest(string Project, string Name, string Title, string Target, IReadOnlyList<string> Captured, IReadOnlyList<string>? Assumptions, IReadOnlyList<string>? ToFill, string Source);
