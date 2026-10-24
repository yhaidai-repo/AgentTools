namespace PowerLoom.Infrastructure.VaultScan.Models;

// One record read from a project's open-questions or known-issues register note (the vault rules' record layout).
public sealed record RegisterRecord(string Id, string Title, string Status, bool Resolved, string? Created, string? Updated);
