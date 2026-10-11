namespace PowerLoom.Contracts;

// A PBI was deleted in PowerLoom: its folder in the backlog vault goes, the index is written without it.
public sealed record PbiDeleted(string Vault, int AdoId, string? VaultPath) : IVaultScoped;
