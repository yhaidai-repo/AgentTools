using PowerLoom.Contracts;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Features.Docs.Records;

// Appends a stored WWW record to its vault's www-log.md, once: a written record keeps its WWW-nnn. A vault without
// the log gets none; the row keeps the reason.
public sealed class WwwRecordWriter(PowerLoomDbContext db, VaultFiles files, TimeProvider clock) : IRecordWriter
{
    private const string LogFile = "www-log.md";

    public bool Handles(RecordKind kind) => kind == RecordKind.Www;

    public async Task<string> WriteAsync(RecordKind kind, string vault, string sourceId, CancellationToken cancellation)
    {
        var row = int.TryParse(sourceId, out var id) ? await db.WwwRecords.FindAsync([id], cancellation) : null;

        if (row is null)
            return $"www record {sourceId}: not found";

        if (row.RecordId is not null)
            return $"www record {sourceId}: already {row.RecordId}";

        var log = await files.ReadTextAsync(row.Vault, LogFile, cancellation);

        return log is null ? await RememberMissingLogAsync(row, cancellation) : await AppendAsync(row, log, cancellation);
    }

    private async Task<string> RememberMissingLogAsync(WwwRecord row, CancellationToken cancellation)
    {
        row.Error = $"{row.Vault} has no {LogFile}";

        await db.SaveChangesAsync(cancellation);

        return $"www record {row.Id}: {row.Error}";
    }

    private async Task<string> AppendAsync(WwwRecord row, string log, CancellationToken cancellation)
    {
        var (text, recordId) = WwwLog.Append(log, ToEntry(row), DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime));

        await files.WriteTextAsync(row.Vault, LogFile, text, cancellation);

        row.RecordId = recordId;
        row.WrittenAt = clock.GetUtcNow().UtcDateTime;
        row.Error = null;

        await db.SaveChangesAsync(cancellation);

        return $"{recordId} written to {row.Vault}";
    }

    private static WwwEntry ToEntry(WwwRecord row)
    {
        return new WwwEntry(row.Title, row.Kind, row.Project, row.Planned, row.Happened, row.Fault, row.RootCause, row.Resolution, row.PreventiveAction, row.Assumptions);
    }
}
