namespace PowerLoom.Features.Vaults.Add.Models;

// What the user typed: the folder name under the vaults root, or the folder's path on the PC.
public sealed record AddVaultRequest(string Folder);
