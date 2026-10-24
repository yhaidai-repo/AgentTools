using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Features.Cleanup;

// Every removal, dry-run candidate and failure is a `data_access` row of kind `cleanup`: the dashboard sums the freed
// bytes from them, and the log says what went where and when.
public sealed class CleanupLog(PowerLoomDbContext db)
{
    public const string Kind = "cleanup";
    public const string Actor = "cleanup";
    public const string Planned = "planned";
    public const string Ok = "ok";
    public const string Failed = "failed";

    public async Task WriteAsync(string vault, DateTimeOffset at, IReadOnlyList<CleanupAction> actions, int durationMs, CancellationToken cancellation)
    {
        db.DataAccesses.AddRange(actions.Select(action => RowOf(vault, at, action, durationMs)));

        await db.SaveChangesAsync(cancellation);
    }

    private static DataAccess RowOf(string vault, DateTimeOffset at, CleanupAction action, int durationMs) => new()
    {
        Vault = vault,
        AgentId = Actor,
        Tool = Actor,
        Kind = Kind,
        Resource = action.Store,
        Target = action.Target,
        Request = action.Deleted ? "delete" : "dry-run",
        Outcome = OutcomeOf(action),
        Reason = action.Error,
        Rows = 1,
        Bytes = (int)Math.Min(action.Bytes, int.MaxValue),
        StartedAt = at.UtcDateTime,
        DurationMs = durationMs,
    };

    private static string OutcomeOf(CleanupAction action)
    {
        if (action.Error is not null)
            return Failed;

        return action.Deleted ? Ok : Planned;
    }
}
