using Microsoft.EntityFrameworkCore;
using PowerLoom.Infrastructure.VaultScan;
using PowerLoom.Infrastructure.VaultScan.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Tasks.Producers;

// What one vault offers the vault-review agent (user decision 2026-10-03: stale = no inbound link or no use for
// staleDays; a note's age doesn't matter, 2026-10-06). Protected notes and notes decided recently are left out; dead
// links count only where the agent may fix them; open register records too (user decision 2026-10-06), unless one was
// kept recently. The agent's own tools list the same candidates; this is the tick's count.
public static class VaultReviewCandidates
{
    public const int DefaultStaleDays = 60;

    private static readonly ItemStatus[] WaitingTask = [ItemStatus.Open, ItemStatus.InProgress, ItemStatus.Blocked];

    public static async Task<int> CountAsync(PowerLoomDbContext db, VaultIndex index, int staleDays, DateTime now, CancellationToken cancellation)
    {
        var recheckFrom = now.AddDays(-staleDays);
        var settledNotes = await SettledNotesAsync(db, index.Vault, recheckFrom, cancellation);
        var settledRecords = await SettledRecordsAsync(db, index.Vault, recheckFrom, cancellation);
        var reviewable = index.Notes.Where(note => !ProtectedNotes.IsProtectedNote(note.Path) && !settledNotes(note)).ToList();
        var stale = reviewable.Where(note => IsUnused(index, note, recheckFrom));
        var unlinked = reviewable.Where(note => index.LinksTo(note.Path).Count == 0);
        var deadLinks = index.DeadLinks().Count(link => ProtectedNotes.IsLinkEditable(link.From));
        var records = index.Notes.SelectMany(note => MaintenanceRecords.Of(note.Path, note.Content)).Count(record => record.IsOpen && !settledRecords(record));

        return stale.Concat(unlinked).Select(note => note.Path).Distinct().Count() + deadLinks + records;
    }

    // "Never used" means something only once the log is older than staleDays (logs began 2026-09-30).
    private static bool IsUnused(VaultIndex index, ScannedNote note, DateTime cutoff)
    {
        var logStart = index.LogStartedAt();

        if (logStart is null || logStart > cutoff)
            return false;

        var lastUse = index.LastUse(note.Path);

        return lastUse is null || lastUse < cutoff;
    }

    // A note is settled while the tech-writer task its `actualize` created waits, and for staleDays after any decision
    // unless it changed since.
    private static async Task<Func<ScannedNote, bool>> SettledNotesAsync(PowerLoomDbContext db, string vault, DateTime recheckFrom, CancellationToken cancellation)
    {
        var rows = await db.VaultReviewDecisions.AsNoTracking()
            .Where(decision => decision.Vault == vault && decision.RecordId == null)
            .Select(decision => new { decision.Path, decision.NoteMtime, decision.DecidedAt, TaskStatus = db.LocalItems.Where(item => item.Id == decision.TaskId).Select(item => (ItemStatus?)item.Status).FirstOrDefault() })
            .ToListAsync(cancellation);
        var relevant = rows.Where(row => row.DecidedAt >= recheckFrom || (row.TaskStatus is { } status && WaitingTask.Contains(status))).ToList();

        return note => relevant.Any(row => row.Path == note.Path && ((row.TaskStatus is { } status && WaitingTask.Contains(status)) || (row.DecidedAt >= recheckFrom && note.Mtime <= row.NoteMtime)));
    }

    // A record kept within staleDays stays settled until its own `Updated` date moves past the decision's day (the
    // register's mtime changes with every other record, so it can't tell).
    private static async Task<Func<MaintenanceRecord, bool>> SettledRecordsAsync(PowerLoomDbContext db, string vault, DateTime recheckFrom, CancellationToken cancellation)
    {
        var rows = await db.VaultReviewDecisions.AsNoTracking()
            .Where(decision => decision.Vault == vault && decision.RecordId != null && decision.DecidedAt >= recheckFrom)
            .Select(decision => new { decision.Path, decision.RecordId, decision.DecidedAt })
            .ToListAsync(cancellation);

        return record => rows.Any(row => row.Path == record.Path && row.RecordId == record.Id && string.CompareOrdinal(record.Updated ?? "", row.DecidedAt.ToUniversalTime().ToString("yyyy-MM-dd")) <= 0);
    }
}
