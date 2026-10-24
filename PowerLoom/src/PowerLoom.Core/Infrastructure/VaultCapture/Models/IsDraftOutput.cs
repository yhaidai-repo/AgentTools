namespace PowerLoom.Infrastructure.VaultCapture.Models;

// The `is-draft` command's JSON: each name → still in the draft folder.
public sealed record IsDraftOutput(bool Ok, Dictionary<string, bool>? Drafts, List<string>? Errors);
