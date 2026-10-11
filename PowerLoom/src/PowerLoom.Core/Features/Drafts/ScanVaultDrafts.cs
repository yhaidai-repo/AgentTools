using PowerLoom.Contracts;

namespace PowerLoom.Features.Drafts;

// The drafts scan of one vault (every 10 minutes): the only part of adoa that looks at the draft folders, and only
// through VaultCapture's draft commands.
public sealed record ScanVaultDrafts(string Vault) : IVaultScoped;
