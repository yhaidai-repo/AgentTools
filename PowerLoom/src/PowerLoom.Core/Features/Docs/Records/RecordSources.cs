using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Docs.Records;

// The vault a record's source row belongs to: the message is partitioned by it.
public sealed class RecordSources(PowerLoomDbContext db)
{
    public async Task<Outcome<string>> VaultOfAsync(RecordKind kind, string sourceId, CancellationToken cancellation)
    {
        var vault = kind == RecordKind.Www ? await VaultOfWwwRecordAsync(sourceId, cancellation) : await VaultOfItemAsync(sourceId, cancellation);

        return vault is null ? Outcome<string>.Failure(Problem.NotFound($"{kind} source {sourceId} isn't known.")) : Outcome<string>.Success(vault);
    }

    private async Task<string?> VaultOfWwwRecordAsync(string sourceId, CancellationToken cancellation)
    {
        if (!int.TryParse(sourceId, out var id))
            return null;

        return await db.WwwRecords.Where(row => row.Id == id).Select(row => row.Vault).SingleOrDefaultAsync(cancellation);
    }

    private Task<string?> VaultOfItemAsync(string itemId, CancellationToken cancellation)
    {
        return db.LocalItems.Where(item => item.Id == itemId).Select(item => item.Vault).SingleOrDefaultAsync(cancellation);
    }
}
