using PowerLoom.Contracts;

namespace PowerLoom.AdoIntegration.Features.SyncRepositories;

// Refreshes the vault's catalog of ADO repos (what refinement picks from). Sent by the button, after a connection save,
// and by every PBI sync.
public sealed record SyncRepositories(string Vault) : IVaultScoped;
