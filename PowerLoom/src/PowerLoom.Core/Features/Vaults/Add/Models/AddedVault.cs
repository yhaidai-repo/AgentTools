namespace PowerLoom.Features.Vaults.Add.Models;

// The vault's name and what its folder was missing (paths relative to the vault), for the page's message.
public sealed record AddedVault(string Vault, IReadOnlyList<string> Created);
