using Npgsql;
using PowerLoom.Infrastructure.ErrorLog.Models;

namespace PowerLoom.Infrastructure.ErrorLog;

// Writes the backend's warnings and errors to log_entry (a repeat adds to its row's count) and keeps the table small:
// rows go after 14 days, and only the newest 20,000 stay (user decision 2026-10-25). Plain SQL on its own connection,
// so writing a log entry never logs through EF again.
public sealed class ErrorLogStore(NpgsqlDataSource dataSource)
{
    public const string Service = "backend";
    public static readonly TimeSpan Retention = TimeSpan.FromDays(14);
    public const int MaxRows = 20_000;

    private const string Upsert = """
        INSERT INTO log_entry (service, level, message, fingerprint)
        VALUES (@service, @level, @message, @fingerprint)
        ON CONFLICT (fingerprint) DO UPDATE SET count = log_entry.count + 1, last_at = now(), message = excluded.message
        """;

    private const string PurgeOld = "DELETE FROM log_entry WHERE last_at < @before";
    private const string PurgeOverCap = "DELETE FROM log_entry WHERE id IN (SELECT id FROM log_entry ORDER BY last_at DESC OFFSET @keep)";

    public async Task RecordAsync(PendingLogEntry entry, CancellationToken cancellation)
    {
        await using var command = dataSource.CreateCommand(Upsert);

        command.Parameters.AddWithValue("service", Service);
        command.Parameters.AddWithValue("level", entry.Level);
        command.Parameters.AddWithValue("message", ErrorLogFingerprint.MessageOf(entry.Message));
        command.Parameters.AddWithValue("fingerprint", ErrorLogFingerprint.Of(Service, entry.Level, null, entry.Message));
        await command.ExecuteNonQueryAsync(cancellation);
    }

    public async Task<int> PurgeAsync(DateTime now, CancellationToken cancellation, int maxRows = MaxRows)
    {
        await using var old = dataSource.CreateCommand(PurgeOld);
        await using var overCap = dataSource.CreateCommand(PurgeOverCap);

        old.Parameters.AddWithValue("before", now - Retention);
        overCap.Parameters.AddWithValue("keep", maxRows);

        return await old.ExecuteNonQueryAsync(cancellation) + await overCap.ExecuteNonQueryAsync(cancellation);
    }
}
