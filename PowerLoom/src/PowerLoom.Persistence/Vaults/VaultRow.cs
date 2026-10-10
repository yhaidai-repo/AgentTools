namespace PowerLoom.Persistence.Vaults;

// adoa's `vault` table: a vault is an account; a removed one keeps its rows and history.
public sealed class VaultRow
{
    public required string Name { get; init; }

    public required string Features { get; init; }

    public string? ImportFolder { get; init; }

    public DateTimeOffset? RemovedAt { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
