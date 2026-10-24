namespace PowerLoom.Features.Vaults.Trash.Models;

// A file in the vault's `.trash/`, by its path inside the trash.
public sealed record TrashEntry(string Path, long SizeBytes, DateTimeOffset ModifiedAt);
