using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// Bugs are prepared without the user (user decision 2026-10-09): a new one, or one whose content changed, gets its
// refinement task. PBIs stay manual.
public static class Bugs
{
    // The sync sets these; a bug in one of them hasn't got its refinement task yet (or needs it again).
    private static readonly PipelineStatus[] NeedsPrepare = [PipelineStatus.New, PipelineStatus.Stale];

    public static async Task<List<BugToPrepare>> ToPrepareAsync(PowerLoomDbContext db, CancellationToken cancellation)
    {
        return await db.Bugs.AsNoTracking()
            .Where(bug => NeedsPrepare.Contains(bug.WorkItem.PipelineStatus))
            .OrderBy(bug => bug.WorkItemId)
            .Select(bug => new BugToPrepare(bug.WorkItemId, bug.WorkItem.Vault))
            .ToListAsync(cancellation);
    }

    // Records a child work item as a bug of its parent, with the parent's status at that moment. A bug already recorded
    // keeps its first record.
    public static async Task RecordAsync(PowerLoomDbContext db, int workItemId, int pbiId, BugSource source, string reportedBy, CancellationToken cancellation)
    {
        if (await db.Bugs.AnyAsync(bug => bug.WorkItemId == workItemId, cancellation))
            return;

        var parentStatus = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == pbiId).Select(row => row.PipelineStatus).SingleAsync(cancellation);

        db.Bugs.Add(new Bug { WorkItemId = workItemId, PbiId = pbiId, Source = source, ReportedBy = reportedBy, FoundIn = parentStatus });

        await db.SaveChangesAsync(cancellation);
    }
}
