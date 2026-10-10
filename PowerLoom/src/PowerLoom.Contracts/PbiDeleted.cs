namespace PowerLoom.Contracts;

// A PBI was deleted in adoa: its folder in the backlog vault goes, the index is written without it.
public sealed record PbiDeleted(string Vault, int AdoId, string? VaultPath) : IVaultScoped;
