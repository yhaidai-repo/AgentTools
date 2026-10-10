namespace PowerLoom.Infrastructure.VaultCapture.Models;

// An agent's captured facts for a docs vault draft (the module's `capture` command).
public sealed record DraftCapture(string Project, string Name, string Title, string Source, string Target, IReadOnlyList<string> Captured, IReadOnlyList<string> Assumptions, IReadOnlyList<string> ToFill);
