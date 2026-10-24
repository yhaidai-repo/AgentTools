namespace PowerLoom.Infrastructure.VaultCapture.Models;

// The `drafts` command's JSON.
public sealed record DraftListOutput(bool Ok, List<VaultDraft>? Drafts, List<string>? Errors);
